import { useEffect, useState, type ReactNode } from "react";
import { Callout, Icon } from "../components";
import {
  FIELD_GUIDES,
  MAP_FIELD_LABELS,
  MAP_FIELDS,
  obbligoEtichetta,
  type MapField,
} from "./campiGiornale";
import { jetGhostClass, jetInputClass, jetPrimaryClass } from "./NotionChrome";
import type { ExtractionProfile, FileInspection, JetSource } from "./api";

function Guide({ field }: { field: MapField }) {
  const g = FIELD_GUIDES[field];
  return (
    <div className="mt-2 rounded-md border border-[#e9e8e4] bg-[#f7f6f3] p-3 space-y-2 text-xs text-[#55534e] leading-5">
      <p>
        <span className="font-medium text-[#2f3437]">
          {obbligoEtichetta(g.obbligo)}
        </span>
        {" · "}
        {g.significato}
      </p>
      <p>
        <strong className="text-[#2f3437] font-medium">Cosa mettere nella casella.</strong>{" "}
        {g.cosaInserire}
      </p>
      <p>
        <strong className="text-[#2f3437] font-medium">Excel.</strong> {g.excel}
      </p>
      <p>
        <strong className="text-[#2f3437] font-medium">Stampa TXT/PDF.</strong> {g.stampa}
      </p>
      <p>
        <strong className="text-[#2f3437] font-medium">Se lo lasci vuoto.</strong> {g.seManca}
      </p>
      <p>
        <strong className="text-[#2f3437] font-medium">Criteri JET.</strong> {g.criteri}
      </p>
    </div>
  );
}

function FieldHead({
  field,
  open,
  onToggle,
  extra,
}: {
  field: MapField;
  open: boolean;
  onToggle: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs text-[#2f3437] font-medium">
        {MAP_FIELD_LABELS[field]}
      </span>
      {extra}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`guida-${field}`}
        aria-label={`Informazioni su ${MAP_FIELD_LABELS[field]}`}
        onClick={onToggle}
        className={`ml-auto inline-flex items-center justify-center w-8 h-8 rounded-md border ${
          open
            ? "border-[#2f3437] bg-[#f1f1ef]"
            : "border-[#e9e8e4] hover:bg-[#f7f6f3]"
        }`}
      >
        <Icon name="info" size="sm" className="text-[#787774]" />
      </button>
    </div>
  );
}

export function JetMappingDrawer({
  open,
  onClose,
  busy,
  source,
  isProfileFile,
  headers,
  mapping,
  onMappingChange,
  onConfirmMapping,
  txtInspection,
  highlightedHeader,
  profiles,
  selectedProfile,
  onSelectedProfile,
  onApplyProfile,
  profileName,
  onProfileName,
  positions,
  onPositions,
  highlightField,
  onHighlightField,
  onCreateProfile,
  onFillProva,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  source: JetSource | null;
  isProfileFile: boolean;
  headers: string[];
  mapping: Record<string, string>;
  onMappingChange: (next: Record<string, string>) => void;
  onConfirmMapping: () => void;
  txtInspection: Omit<FileInspection, "pratica"> | null;
  highlightedHeader: ReactNode;
  profiles: ExtractionProfile[];
  selectedProfile: string;
  onSelectedProfile: (id: string) => void;
  onApplyProfile: () => void;
  profileName: string;
  onProfileName: (name: string) => void;
  positions: Record<string, { start: string; end: string }>;
  onPositions: (next: Record<string, { start: string; end: string }>) => void;
  highlightField: string;
  onHighlightField: (field: string) => void;
  onCreateProfile: () => void;
  onFillProva: () => void;
}) {
  const [helpField, setHelpField] = useState<MapField | null>(null);
  useEffect(() => {
    if (!open) setHelpField(null);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || !source) return null;
  const toggleHelp = (field: MapField) =>
    setHelpField((current) => (current === field ? null : field));
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      <button
        type="button"
        aria-label="Chiudi pannello mappatura"
        className="absolute inset-0 bg-[#2f3437]/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside
        className="relative h-full w-full max-w-lg bg-white border-l border-[#e9e8e4] shadow-xl flex flex-col"
        role="dialog"
        aria-labelledby="jet-mapping-title"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#e9e8e4] bg-[#faf9f7]">
          <div className="min-w-0">
            <h3
              id="jet-mapping-title"
              className="text-sm font-semibold text-[#2f3437]"
            >
              {isProfileFile ? "Profilo di estrazione" : "Mappatura colonne"}
            </h3>
            <p className="mt-0.5 text-xs text-[#787774] truncate">
              {source.nome_originale}
            </p>
            <p className="mt-1.5 text-xs text-[#9b9a97] leading-5">
              {isProfileFile
                ? "Ogni casella è un intervallo di caratteri sulla riga (inizio incluso, fine esclusa, primo carattere = 0). Premi la i per sapere cosa va in quel campo."
                : "Ogni casella è la colonna Excel da associare a un concetto JET. Premi la i per sapere cosa va in quel campo."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-[#ebebea] shrink-0"
            aria-label="Chiudi"
          >
            <Icon name="close" size="md" className="text-[#787774]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isProfileFile && txtInspection && (
            <div>
              <p className="mb-1.5 text-xs text-[#787774]">
                Intestazione e righe di esempio · {txtInspection.codifica}
              </p>
              <pre className="overflow-x-auto rounded-md bg-[#f7f6f3] p-3 font-mono text-[11px] leading-5 text-[#37352f]">
                <code>
                  {highlightedHeader}
                  {txtInspection.righe_esempio?.map((line, index) => (
                    <span key={index}>{`\n${line}`}</span>
                  ))}
                </code>
              </pre>
              {txtInspection.profilo && (
                <Callout variant="info" className="mt-2">
                  Profilo riconosciuto:{" "}
                  <strong>{txtInspection.profilo.nome}</strong>, creato il{" "}
                  {new Date(txtInspection.profilo.created_at).toLocaleString(
                    "it-IT",
                  )}.
                </Callout>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-2 items-end mt-3">
                <label className="block min-w-0">
                  <span className="block mb-1 text-xs text-[#787774]">
                    Profilo esistente
                  </span>
                  <select
                    value={selectedProfile}
                    onChange={(e) => onSelectedProfile(e.target.value)}
                    className={jetInputClass}
                  >
                    <option value="">Scegli un profilo</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={busy || !selectedProfile}
                  onClick={onApplyProfile}
                  className={jetPrimaryClass}
                >
                  Conferma profilo
                </button>
              </div>
            </div>
          )}
          {!isProfileFile && headers.length > 0 && (
            <p className="text-xs text-[#9b9a97]">
              Intestazioni lette dal file: {headers.join(" · ")}
            </p>
          )}
          {isProfileFile && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-medium text-[#2f3437]">Nuovo profilo</h4>
              <button
                type="button"
                disabled={busy}
                onClick={onFillProva}
                className={jetGhostClass}
              >
                Compila posizioni di prova
              </button>
            </div>
          )}
          {isProfileFile && (
            <label className="block">
              <span className="block mb-1 text-xs text-[#787774]">
                Nome profilo
              </span>
              <input
                value={profileName}
                onChange={(e) => onProfileName(e.target.value)}
                placeholder="es. ALUK stampa giornale"
                className={jetInputClass}
              />
              <p className="mt-1 text-xs text-[#9b9a97] leading-5">
                Solo un’etichetta riusabile. Non è un dato contabile. Lo stesso
                profilo si riapplica ad altri file con la stessa intestazione.
              </p>
            </label>
          )}
          <div className="space-y-3">
            {MAP_FIELDS.map((field) => {
              const openHelp = helpField === field;
              return (
                <div
                  key={field}
                  onFocus={() => onHighlightField(field)}
                  className={
                    highlightField === field
                      ? "rounded-md border border-[#2f3437] p-2"
                      : "rounded-md border border-transparent p-2"
                  }
                >
                  <FieldHead
                    field={field}
                    open={openHelp}
                    onToggle={() => toggleHelp(field)}
                    extra={
                      <span className="text-[11px] text-[#9b9a97]">
                        {obbligoEtichetta(FIELD_GUIDES[field].obbligo)}
                      </span>
                    }
                  />
                  {isProfileFile
                    ? (
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          aria-label={`${MAP_FIELD_LABELS[field]} inizio`}
                          type="number"
                          min="0"
                          placeholder="Inizio"
                          value={positions[field]?.start || ""}
                          onChange={(e) =>
                            onPositions({
                              ...positions,
                              [field]: {
                                start: e.target.value,
                                end: positions[field]?.end || "",
                              },
                            })}
                          className={jetInputClass}
                        />
                        <input
                          aria-label={`${MAP_FIELD_LABELS[field]} fine esclusiva`}
                          type="number"
                          min="1"
                          placeholder="Fine esclusiva"
                          value={positions[field]?.end || ""}
                          onChange={(e) =>
                            onPositions({
                              ...positions,
                              [field]: {
                                start: positions[field]?.start || "",
                                end: e.target.value,
                              },
                            })}
                          className={jetInputClass}
                        />
                      </div>
                    )
                    : (
                      <select
                        value={mapping[field] || ""}
                        onChange={(e) => {
                          const next = { ...mapping };
                          if (e.target.value) next[field] = e.target.value;
                          else delete next[field];
                          onMappingChange(next);
                        }}
                        className={jetInputClass}
                      >
                        <option value="">Non mappato</option>
                        {headers.map((h) => <option key={h}>{h}</option>)}
                      </select>
                    )}
                  {openHelp && (
                    <div id={`guida-${field}`}>
                      <Guide field={field} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t border-[#e9e8e4] bg-[#faf9f7]">
          {isProfileFile
            ? (
              <button
                type="button"
                disabled={busy || !profileName.trim()}
                onClick={onCreateProfile}
                className={`${jetPrimaryClass} w-full`}
              >
                Salva e applica profilo
              </button>
            )
            : (
              <button
                type="button"
                disabled={busy || headers.length === 0}
                onClick={onConfirmMapping}
                className={`${jetPrimaryClass} w-full`}
              >
                Conferma mappatura
              </button>
            )}
        </div>
      </aside>
    </div>
  );
}
