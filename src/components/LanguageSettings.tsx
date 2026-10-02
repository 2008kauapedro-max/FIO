import React from "react";
import { Check } from "lucide-react";
import { LOCALE_OPTIONS, type SupportedCurrency, type SupportedLocale } from "../i18n/config";
import { useI18n } from "../i18n/I18nProvider";

type LanguageSettingsProps = {
  onSave?: (preferences: {
    preferred_locale: SupportedLocale;
    preferred_region: string;
    preferred_currency: SupportedCurrency;
  }) => Promise<void> | void;
};

export function LanguageSettings({ onSave }: LanguageSettingsProps) {
  const { locale, region, currency, setLocale, setRegion, setCurrency, t } = useI18n();
  const [busy,setBusy]=React.useState(false);

  async function handleSave() {
    if(!onSave)return;
    setBusy(true);
    try{
      await onSave({ preferred_locale: locale, preferred_region: region, preferred_currency: currency });
    }finally{setBusy(false);}
  }

  return (
    <div className="language-settings">
      <div className="section-title">
        <div><h2>{t("language.region")}</h2><p className="muted">{t("language.subtitle")}</p></div>
      </div>
      <div className="language-option-grid">
        {LOCALE_OPTIONS.map(option=>(
          <button key={option.value} type="button" className={`language-option ${option.value===locale?'selected':''}`} onClick={()=>setLocale(option.value,{persistLocal:true,updateDefaults:true})}>
            <span className="language-flag" aria-hidden="true">{option.flag}</span>
            <span><strong>{option.nativeLabel}</strong><small>{option.value}</small></span>
            {option.value===locale&&<Check size={17}/>}
          </button>
        ))}
      </div>
      <div className="form-grid language-region-grid">
        <label className="field"><span>{t("language.regionLabel")}</span><input value={region} onChange={e=>setRegion(e.target.value)} maxLength={2}/></label>
        <label className="field"><span>{t("language.currencyLabel")}</span><select value={currency} onChange={e=>setCurrency(e.target.value as SupportedCurrency)}>
          <option value="BRL">BRL</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="MXN">MXN</option><option value="ARS">ARS</option>
        </select></label>
      </div>
      {onSave&&<button type="button" className="primary" onClick={()=>void handleSave()} disabled={busy}>{busy?t("common.saving"):t("common.save")}</button>}
    </div>
  );
}
