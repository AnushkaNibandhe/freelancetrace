import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GitBranch, Loader2, ShieldCheck, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const emailSchema = z.string().email('Invalid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const AdminAuth: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; secretKey?: string }>({});

  const { signIn, adminSignUp, user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user && profile) {
      if (profile.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        // Signed in but not admin — redirect to their portal
        const path = profile.role === 'client' ? '/client/dashboard' : '/freelancer/dashboard';
        navigate(path, { replace: true });
      }
    }
  }, [user, profile, loading, navigate]);

  const validate = (includeSecret = false) => {
    const newErrors: typeof errors = {};
    try { emailSchema.parse(email); } catch (e: any) { newErrors.email = e.errors[0].message; }
    try { passwordSchema.parse(password); } catch (e: any) { newErrors.password = e.errors[0].message; }
    if (includeSecret && !secretKey.trim()) newErrors.secretKey = 'Admin secret key is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    const { error } = await signIn(email, password, 'admin');
    setIsLoading(false);
    if (error) {
      toast({ title: 'Sign in failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate(true)) return;
    setIsLoading(true);
    const { error } = await adminSignUp(email, password, fullName, secretKey);
    setIsLoading(false);
    if (error) {
      toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Admin account created', description: 'Welcome to the admin portal.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 p-12 flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <GitBranch className="h-6 w-6 text-primary" />
          </div>
          <span className="text-2xl font-bold text-white">FreelanceTrace</span>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <span className="text-white text-xl font-semibold">Admin Portal</span>
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight">
            Platform Control Center
          </h1>
          <p className="text-lg text-zinc-400 max-w-md">
            Manage users, monitor projects, resolve disputes, and view platform-wide analytics — all in one place.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2">
            {[
              { label: 'User Management', desc: 'Suspend, verify & manage all users' },
              { label: 'Project Kanban', desc: 'Visual overview of all projects' },
              { label: 'Dispute Resolution', desc: 'Handle and resolve disputes' },
              { label: 'Analytics', desc: 'Charts, trends & platform stats' },
            ].map(item => (
              <div key={item.label} className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white font-medium text-sm">{item.label}</p>
                <p className="text-zinc-400 text-xs mt-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-zinc-500">
          © 2024 FreelanceTrace. Admin access only.
        </p>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center justify-center gap-2 lg:hidden">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <GitBranch className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary">FreelanceTrace</span>
          </div>

          <Card className="border shadow-xl">
            <CardHeader className="text-center space-y-1 pb-4">
              <div className="flex items-center justify-center gap-2 mb-1">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-primary uppercase tracking-wider">Admin Portal</span>
              </div>
              <CardTitle className="text-2xl">Administrator Access</CardTitle>
              <CardDescription>Sign in or create an admin account</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="signin" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="signin">Sign In</TabsTrigger>
                  <TabsTrigger value="signup">Create Admin</TabsTrigger>
                </TabsList>

                {/* Sign In */}
                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-signin-email">Admin Email</Label>
                      <Input
                        id="admin-signin-email"
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-signin-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="admin-signin-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(v => !v)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</> : 'Sign In as Admin'}
                    </Button>
                  </form>
                </TabsContent>

                {/* Sign Up */}
                <TabsContent value="signup">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-signup-name">Full Name</Label>
                      <Input
                        id="admin-signup-name"
                        type="text"
                        placeholder="Admin Name"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-signup-email">Email</Label>
                      <Input
                        id="admin-signup-email"
                        type="email"
                        placeholder="admin@example.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-signup-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="admin-signup-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(v => !v)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="admin-secret" className="flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" />
                        Admin Secret Key
                      </Label>
                      <div className="relative">
                        <Input
                          id="admin-secret"
                          type={showSecret ? 'text' : 'password'}
                          placeholder="Enter admin secret key"
                          value={secretKey}
                          onChange={e => setSecretKey(e.target.value)}
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowSecret(v => !v)}
                        >
                          {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {errors.secretKey && <p className="text-xs text-destructive">{errors.secretKey}</p>}
                      <p className="text-xs text-muted-foreground">
                        Contact your system administrator for the secret key.
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</> : 'Create Admin Account'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-6 text-center">
                <Link to="/auth" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  ← Back to regular sign in
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminAuth;
