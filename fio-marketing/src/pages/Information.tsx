import { links } from "../data/config";
import {
  PRIVACY_POLICY,
  TERMS_OF_USE,
} from "../../../shared/legal";

export function Information({ page }: { page: string }) {
  const privacy = page === "/privacidade";
  const terms = page === "/termos";
  const contact = page === "/contato";
  const legal = privacy ? PRIVACY_POLICY : terms ? TERMS_OF_USE : null;

  if (legal) {
    return (
      <main className="container information-page" id="conteudo">
        <a className="text-link" href="/">
          Voltar para o FIO
        </a>

        <span className="eyebrow">FIO / DOCUMENTO PÚBLICO</span>
        <h1>{legal.title}</h1>
        <p className="legal-updated">
          Última atualização: {legal.updated}
        </p>

        <div className="legal-intro">
          {legal.intro.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>

        {legal.sections.map((section) => (
          <section className="legal-section" key={section.title}>
            <h2>{section.title}</h2>

            {section.paragraphs?.map((text, index) => (
              <p key={"p-" + index}>{text}</p>
            ))}

            {section.bullets?.length ? (
              <ul>
                {section.bullets.map((text, index) => (
                  <li key={"b-" + index}>{text}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <div className="legal-contact">
          <strong>Contato</strong>
          <a href={"mailto:" + legal.contactEmail}>
            {legal.contactEmail}
          </a>
        </div>
      </main>
    );
  }

  if (contact) {
    return (
      <main className="container information-page" id="conteudo">
        <a className="text-link" href="/">
          Voltar para o FIO
        </a>
        <span className="eyebrow">FIO / CONTATO</span>
        <h1>Fale com o FIO</h1>
        <p>
          Para suporte, privacidade e assuntos relacionados à plataforma:
        </p>
        <p>
          <a className="text-link" href="mailto:usefiooficial@gmail.com">
            usefiooficial@gmail.com
          </a>
        </p>
        <a className="button" href={links.login}>
          Acessar meu painel
        </a>
      </main>
    );
  }

  return (
    <main className="container information-page" id="conteudo">
      <a className="text-link" href="/">
        Voltar para o FIO
      </a>
      <span className="eyebrow">FIO / INFORMAÇÕES</span>
      <h1>Página não encontrada</h1>
      <p>Este endereço não existe.</p>
    </main>
  );
}
