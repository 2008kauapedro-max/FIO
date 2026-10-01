import { Logo } from "./Header";
import { links } from "../data/config";
export function Footer() {
  return (
    <footer className="footer container">
      <div className="footer-top">
        <div className="footer-brand">
          <Logo />
          <p>
            O digital da sua barbearia.
            <br />
            Do seu jeito.
          </p>
        </div>
        <div className="footer-group">
          <h2>Produto</h2>
          <a href="/#produto">Recursos</a>
          <a href="/#planos">Planos</a>
          <a href={links.login}>Entrar</a>
        </div>
        <div className="footer-group">
          <h2>Empresa</h2>
          {links.instagram ? (
            <a href={links.instagram}>Instagram</a>
          ) : (
            <span>
              Instagram <small>em breve</small>
            </span>
          )}
          {links.contact ? (
            <a href={links.contact}>Contato</a>
          ) : (
            <a href="/contato">Contato</a>
          )}
        </div>
        <div className="footer-group">
          <h2>Legal</h2>
          <a href="/termos">Termos</a>
          <a href="/privacidade">Privacidade</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          © {new Date().getFullYear()} FIO. Todos os direitos reservados.
        </span>
        <span>Feito para o seu próximo horário.</span>
      </div>
    </footer>
  );
}
