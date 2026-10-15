import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mountain, Grip, Smartphone, ArrowRight, LogOut } from "lucide-react";

// Import shadcn components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useSession } from "@/context/SessionContext";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
}) => {
  return (
    <Card className="border-border/50 bg-background/50 backdrop-blur-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
      <CardContent className="pt-8 pb-8 flex flex-col items-center text-center px-6">
        <div className="p-4 bg-primary/10 rounded-2xl mb-6 text-primary">
          {icon}
        </div>
        <CardTitle className="mb-3 text-xl">{title}</CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
};

const LandingPage = () => {
  const { session, signOutUser } = useSession();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-700/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800">
            <Mountain className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">Garage Grind</span>
          </div>

          <div>
            {session?.user ? (
              <Button
                variant="ghost"
                className="text-black"
                onClick={() => signOutUser()}
              >
                <LogOut className="w-4 h-4 mr-2" />
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="secondary" className="font-semibold">
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-slate-800 text-white flex-1 flex flex-col justify-center py-20 lg:py-32 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-10">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute bottom-12 -left-12 w-64 h-64 bg-blue-500 rounded-full blur-3xl"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter leading-[1.1] mb-6">
              Build.<br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-orange-800 to-orange-400">
                Set.
              </span><br />
              Send.
            </h1>
            <p className="text-xl md:text-2xl text-slate-300 mb-10 max-w-xl leading-relaxed">
              Straightforward home wall and route management. Map your holds, set custom problems, and track your sends all in one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              {session?.user ? (
                <Button
                  size="lg"
                  className="bg-white text-black font-semibold h-14 px-8 hover:bg-slate-200"
                  onClick={() => navigate('/protected')}
                >
                  Go to Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              ) : (
                <Link to="/auth">
                  <Button size="lg" className="bg-white text-black font-semibold h-14 px-8 w-full sm:w-auto hover:bg-slate-200">
                    Get Started for Free
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-zinc-50 relative z-20 -mt-6 rounded-t-3xl border-t border-border shadow-sm">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">
              Everything your wall needs.
            </h2>
            <p className="text-lg text-muted-foreground">
              Ditch the tape and spreadsheets. Garage Grind brings modern route setting tools to your personal climbing wall.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Grip size={28} />}
              title="Custom Board Setup"
              description="Upload a photo of your wall and map out every single hold to create your digital canvas."
            />
            <FeatureCard
              icon={<Smartphone size={28} />}
              title="Interactive Setting"
              description="Tap holds to assign starts, hands, and feet. Build entire routes in seconds from your phone."
            />
            <FeatureCard
              icon={<Mountain size={28} />}
              title="Log Your Sends"
              description="Keep a historical record of your hardest ascents and track your progress over time."
            />
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="bg-zinc-50 py-8 border-t border-border/50 text-center text-muted-foreground">
        <p className="text-sm">© {new Date().getFullYear()} Garage Grind. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;