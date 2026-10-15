using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using ClimbingApp.Api.Dtos;

namespace ClimbingApp.Api.Services;

public interface IDetectorClient
{
    Task<DetectionResult> DetectAsync(Stream image, string fileName, string contentType, CancellationToken ct);
}

public class DetectorClient : IDetectorClient
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
    };

    private readonly HttpClient _http;
    private readonly string _baseUrl;

    public DetectorClient(HttpClient http, IConfiguration config)
    {
        _http = http;
        _baseUrl = (config["ML_SERVICE_URL"] ?? "http://localhost:8081").TrimEnd('/');
    }

    public async Task<DetectionResult> DetectAsync(Stream image, string fileName, string contentType, CancellationToken ct)
    {
        using var form = new MultipartFormDataContent();
        var streamContent = new StreamContent(image);
        streamContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(streamContent, "image", fileName);

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_baseUrl}/detect") { Content = form };

        // On Cloud Run, authenticate to the (private) ML service with an ID token.
        var idToken = await GetIdTokenAsync(ct);
        if (idToken is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", idToken);
        }

        using var response = await _http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            throw new HttpRequestException($"ML service returned {(int)response.StatusCode}: {body}");
        }

        var result = await response.Content.ReadFromJsonAsync<DetectionResult>(JsonOpts, ct);
        return result ?? throw new HttpRequestException("ML service returned an empty body.");
    }

    private async Task<string?> GetIdTokenAsync(CancellationToken ct)
    {
        // Cloud Run metadata server issues an audience-scoped identity token for the
        // runtime service account. Absent off-GCP (e.g. local dev), so ML is called unauthenticated.
        try
        {
            using var metadata = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
            metadata.DefaultRequestHeaders.Add("Metadata-Flavor", "Google");
            var url = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity"
                      + $"?audience={Uri.EscapeDataString(_baseUrl)}";
            var token = await metadata.GetStringAsync(url, ct);
            return string.IsNullOrWhiteSpace(token) ? null : token;
        }
        catch
        {
            return null;
        }
    }
}
