import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Lock, Mail, Github, Zap, Loader2, ShieldCheck, ArrowRight } from 'lucide-react';

interface AuthProps {
    onAuthenticated: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onAuthenticated }) => {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                setError('Check your email for the confirmation link.');
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                onAuthenticated();
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred during authentication');
            // If no Supabase URL is provided, allow a "demo" login
            if (!import.meta.env.VITE_SUPABASE_URL && email === 'demo@henu.io' && password === 'demo123') {
                onAuthenticated();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGithubLogin = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('Initiating GitHub OAuth with redirect to:', window.location.origin);
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'github',
                options: {
                    redirectTo: window.location.origin,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) throw error;
        } catch (err: any) {
            console.error('GitHub Login Error:', err);
            setError(`GitHub Error: ${err.message || 'Check if GitHub Provider is enabled in Supabase'}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-[1000] overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-950/20 via-black to-slate-950/20"></div>
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                backgroundImage: `linear-gradient(rgba(239, 68, 68, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(239, 68, 68, 0.1) 1px, transparent 1px)`,
                backgroundSize: '40px 40px',
            }} />

            {/* Animated Glows */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

            <div className="relative w-full max-w-md p-8 backdrop-blur-2xl bg-white/[0.02] border border-white/10 rounded-2xl shadow-2xl animate-fadeIn">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-900 rounded-xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
                        <Zap className="text-white w-10 h-10" fill="white" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tighter text-glow-accent mb-1 text-white">HENU OS</h1>
                    <p className="text-gray-400 text-sm font-medium">INDUSTRIAL CONSOLE ACCESS</p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className={`mb-6 p-3 rounded-lg flex items-center space-x-2 text-xs border ${error.includes('Check') ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        <ShieldCheck size={14} />
                        <span>{error}</span>
                    </div>
                )}

                {/* Auth Form */}
                <form onSubmit={handleAuth} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Email Terminal</label>
                        <div className="relative group">
                            <div className="absolute inset-0 bg-red-500/5 rounded-lg border border-white/5 group-focus-within:border-red-500/50 transition-all duration-300"></div>
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-500 transition-colors" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="system@henu.io"
                                className="w-full bg-transparent border-none py-3 pl-10 pr-4 text-white text-sm focus:outline-none relative z-10"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Encryption Key</label>
                        <div className="relative group">
                            <div className="absolute inset-0 bg-red-500/5 rounded-lg border border-white/5 group-focus-within:border-red-500/50 transition-all duration-300"></div>
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-500 transition-colors" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-transparent border-none py-3 pl-10 pr-4 text-white text-sm focus:outline-none relative z-10"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 text-white font-bold py-3 rounded-lg transition-all duration-200 mt-6 shadow-[0_0_15px_rgba(220,38,38,0.3)] flex items-center justify-center space-x-2"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <>
                                <span>{isSignUp ? 'INITIALIZE ACCOUNT' : 'SECURE ACCESS'}</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="flex items-center my-8">
                    <div className="flex-1 h-px bg-white/5"></div>
                    <span className="px-4 text-[10px] text-gray-500 uppercase tracking-widest font-bold">Protocol Login</span>
                    <div className="flex-1 h-px bg-white/5"></div>
                </div>

                {/* Social Auth */}
                <button
                    onClick={handleGithubLogin}
                    className="w-full bg-white/5 hover:bg-white/10 active:scale-[0.98] text-white py-3 rounded-lg border border-white/5 transition-all duration-200 flex items-center justify-center space-x-3"
                >
                    <Github size={20} />
                    <span className="text-sm font-medium">Continue with GitHub</span>
                </button>

                {/* Footer and Help */}
                <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="w-full text-[11px] text-gray-400 hover:text-red-400 transition-colors uppercase tracking-widest font-bold text-center"
                    >
                        {isSignUp ? 'Already have access? Sign In' : 'Need new credentials? Register'}
                    </button>

                    <div className="bg-black/40 rounded-lg p-3 border border-white/5">
                        <p className="text-[9px] text-gray-500 leading-relaxed text-center uppercase tracking-tighter">
                            <span className="text-red-500 font-bold block mb-1">TROUBLESHOOTING</span>
                            If GitHub fails: Ensure <code className="text-gray-300">http://localhost:5173</code> is set as the <span className="text-white">Site URL</span> in Supabase Auth settings.
                            <br /><br />
                            <span className="text-gray-400">DEMO MODE: use <span className="text-white">demo@henu.io</span> / <span className="text-white">demo123</span></span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
