import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useSession } from "@/context/SessionContext";

// Firebase auth error `code`s are a documented, stable API contract:
// https://firebase.google.com/docs/reference/js/auth.md#autherrorcodes
function authErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered.";
    case "auth/invalid-email":
      return "That email address is not valid.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return error instanceof Error
        ? error.message.replace(/^Firebase:\s*/, "")
        : "An unexpected error occurred.";
  }
}

export function AuthPage() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(credentials.user);

      toast.success(
        "Registration successful! Please check your email for verification."
      );
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      navigate("/protected");
    }
  }, [session, navigate]);

  return (
    <div className="flex items-start justify-center h-screen p-6 md:p-10 bg-slate-800">
      <div className="w-full max-w-md p-8 pb-18 pt-12 rounded-md shadow-md bg-white">
        <Tabs defaultValue="login" className="w-full">
          <div className="flex flex-col items-center gap-2 mb-2 text-center">
            <img src="/logo.png" alt="logo" width={150} height={150} />
            <h1 className="text-2xl font-bold  text-primary">Hazel Climbing</h1>
            <p className="text-primary opacity-80 font-medium">
              Build - Set - Send
            </p>
          </div>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="register">Register</TabsTrigger>
          </TabsList>

          {/* Login Tab Content */}
          <TabsContent value="login">
            <form className="flex flex-col gap-6" onSubmit={handleLogin}>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center">
                    <Label htmlFor="login-password">Password</Label>
                  </div>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Logging In..." : "Login"}
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Register Tab Content */}
          <TabsContent value="register">
            <form className="flex flex-col gap-6" onSubmit={handleRegister}>
              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    placeholder="m@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="register-password">Password</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating Account..." : "Register"}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
