using Google.Apis.Auth.OAuth2;
using Google.Cloud.Storage.V1;

namespace ClimbingApp.Api.Services;

public interface IStorageService
{
    Task UploadAsync(string objectName, Stream content, string contentType, CancellationToken ct);
    Task DeleteAsync(string objectName, CancellationToken ct);
    /// <summary>Returns a short-lived signed URL, or null if signing is unavailable.</summary>
    string? TryGetSignedUrl(string objectName, TimeSpan lifetime);
    string PublicUrl(string objectName);
}

public class GcsStorageService : IStorageService
{
    private readonly string _bucket;
    private readonly StorageClient _client;
    private readonly UrlSigner? _signer;

    public GcsStorageService(IConfiguration config)
    {
        _bucket = config["GCS_BUCKET_NAME"]
            ?? throw new InvalidOperationException("GCS_BUCKET_NAME is not set.");
        _client = StorageClient.Create();

        try
        {
            _signer = UrlSigner.FromCredential(GoogleCredential.GetApplicationDefault());
        }
        catch
        {
            _signer = null;
        }
    }

    public async Task UploadAsync(string objectName, Stream content, string contentType, CancellationToken ct)
    {
        await _client.UploadObjectAsync(_bucket, objectName, contentType, content, cancellationToken: ct);
    }

    public async Task DeleteAsync(string objectName, CancellationToken ct)
    {
        try
        {
            await _client.DeleteObjectAsync(_bucket, objectName, cancellationToken: ct);
        }
        catch (Google.GoogleApiException e) when (e.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            // already gone
        }
    }

    public string? TryGetSignedUrl(string objectName, TimeSpan lifetime)
    {
        if (_signer is null) return null;
        try
        {
            return _signer.Sign(_bucket, objectName, lifetime);
        }
        catch
        {
            return null;
        }
    }

    public string PublicUrl(string objectName)
        => $"https://storage.googleapis.com/{_bucket}/{objectName}";
}
