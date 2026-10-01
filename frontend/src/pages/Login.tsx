import { useNavigate } from "react-router-dom";
import AuthForm from "../components/AuthForm";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  return (
    <AuthForm
      title="Entrar"
      subtitle="Jogos personalizados de League of Legends"
      submitLabel="Entrar"
      footerText="Ainda não tem conta?"
      footerLinkLabel="Cadastre-se"
      footerLinkTo="/cadastro"
      onSubmit={async (riotId, password) => {
        await login(riotId, password);
        navigate("/", { replace: true });
      }}
    />
  );
}
