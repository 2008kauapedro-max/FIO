import {describe,it,expect} from "vitest";
import {existsSync,readFileSync} from "node:fs";

describe("limpeza final da release",()=>{
  it("nao deixa texto de pagamento com encoding quebrado",()=>{
    const source=readFileSync("src/pages/FioPlans.tsx","utf8");
    const broken=/\u00c3(?:\u00a0|\u00a1|\u00a3|\u00a7|\u00a9|\u00aa|\u00ad|\u00b3|\u00b5|\u00ba)|\u00c2\u00b7/;
    expect(broken.test(source)).toBe(false);
  });

  it("nao mantem backups antigos dentro do codigo da release",()=>{
    const dead=[
      "src/App.before-visible-i18n.tsx",
      "src/i18n/dictionaries.before-visible-i18n.ts",
      "src/main.before-i18n.tsx",
      "src/pages/PublicPortal.before-wa.tsx",
      "src/pages/Workspace.before-language-wa.tsx",
      "src/pages/Workspace.before-visible-i18n-fix.tsx",
      "src/pages/Workspace.before-visible-i18n.tsx",
      "src/styles.before-ui-fixes.css",
      "supabase/migrations-backup-20260918"
    ];

    for(const file of dead){
      expect(existsSync(file),file).toBe(false);
    }
  });
});