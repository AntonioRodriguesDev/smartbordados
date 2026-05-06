import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo-smartbordados.png";

const FIXED_USER = "smartbordados";
const FIXED_PASS = "10121908";
const FIXED_EMAIL = "smartbordados@smartbordados.app";

export default function Auth() {
  const nav = useNavigate();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav("/", { replace: true });
    });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (usuario.trim().toLowerCase() !== FIXED_USER || senha !== FIXED_PASS) {
      toast.error("Usuário ou senha incorretos");
      return;
    }
    setLoading(true);
    try {
      let { error } = await supabase.auth.signInWithPassword({ email: FIXED_EMAIL, password: FIXED_PASS });
      if (error) {
        // First time: create the account
        const { error: signUpErr } = await supabase.auth.signUp({
          email: FIXED_EMAIL, password: FIXED_PASS,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (signUpErr) throw signUpErr;
        ({ error } = await supabase.auth.signInWithPassword({ email: FIXED_EMAIL, password: FIXED_PASS }));
        if (error) throw error;
      }
      nav("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/40 to-background p-4">
      <Card className="w-full max-w-md p-8 shadow-elevated border-border/60">
        <div className="flex flex-col items-center mb-6">
          <img src={logo} alt="Smart Bordados" className="w-full max-w-[260px] object-contain mb-2" />
          <p className="text-sm text-muted-foreground">Painel financeiro</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="usuario">Usuário</Label>
            <Input id="usuario" autoComplete="username" required value={usuario} onChange={e => setUsuario(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} />
          </div>
          <Button type="submit" className="w-full gradient-primary text-primary-foreground shadow-elevated" size="lg" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
