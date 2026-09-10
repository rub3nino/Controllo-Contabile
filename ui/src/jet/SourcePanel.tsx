/**
 * Sorgente libro giornale: carica, conferma profilo o mappatura.
 * Un percorso alla volta — profilo esistente XOR nuove posizioni.
 */

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { Icon, StatusBadge, Switch } from "../components";
import {
  JetSection,
  jetGhostClass,
  jetInputClass,
  jetPrimaryClass,
} from "./NotionChrome";
import type {
  ExtractionProfile,
  FileInspection,
  JetPractice,
  JetSource,
} from "./api";

const inputClass = jetInputClass;

export const MAP_FIELDS = [
  "identificativo_registrazione",
  "numero_documento",
  "data_effettiva",
  "data_creazione",
  "ora_creazione",
  "conto_contabile",
  "importo_netto",
  "importo_dare",
  "importo_avere",
  "descrizione",
  "utente",
] as const;

const FIELD_LABELS: Record<string, string> = {
  identificativo_registrazione: "Identificativo",
  numero_documento: "N. documento",
  data_effettiva: "Data effettiva",
  data_creazione: "Data creazione",
  ora_creazione: "Ora creazione",
  conto_contabile: "Conto",
  importo_netto: "Importo netto",
  importo_dare: "Dare",
  importo_avere: "Avere",
  descrizione: "Descrizione",
  utente: "Utente",
};

function sourceStatus(stato: JetSource["stato"]): {
  variant: "success" | "warning" | "error" | "neutral" | "info";
  label: string;
} {
  if (stato === "pronta") return { variant: "success", label: "Pronta" };
  if (stato === "errore") return { variant: "error", label: "Errore" };
  if (stato === "esclusa") return { variant: "neutral", label: "Esclusa" };
  return { variant: "warning", label: "Da configurare" };
}

function ModeTab({
  active,
  onClick,
  children,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-2.5 py-1 min-h-8 text-xs rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? "bg-white text-[#2f3437] shadow-xs font-medium"
          : "text-[#787774] hover:text-[#2f3437]"
      }`}
    >
      {children}
    </button>
  );
}

export function SourcePanel({
  practice,
  sources,
  selectedSource,
  busy,
  headers,
  mapping,
  setMapping,
  profiles,
  txtInspection,
  selectedProfile,
  setSelectedProfile,
  profileName,
  setProfileName,
  positions,
  setPositions,
  setHighlightField,
  highlightedHeader,
  onUpload,
  onSelectSource,
  onToggleActive,
  onReplace,
  onDelete,
  onDuplicates,
  onConfirmMapping,
  onApplyProfile,
  onCreateProfile,
}: {
  practice: JetPractice;
  sources: JetSource[];
  selectedSource: JetSource | null;
  busy: boolean;
  headers: string[];
  mapping: Record<string, string>;
  setMapping: (next: Record<string, string>) => void;
  profiles: ExtractionProfile[];
  txtInspection: Omit<FileInspection, "pratica"> | null;
  selectedProfile: string;
  setSelectedProfile: (id: string) => void;
  profileName: string;
  setProfileName: (name: string) => void;
  positions: Record<string, { start: string; end: string }>;
  setPositions: (next: Record<string, { start: string; end: string }>) => void;
  setHighlightField: (field: string) => void;
  highlightedHeader: ReactNode;
  onUpload: (files: FileList | File[]) => void;
  onSelectSource: (source: JetSource) => void;
  onToggleActive: (source: JetSource, attiva: boolean) => void;
  onReplace: (source: JetSource, file: File) => void;
  onDelete: (source: JetSource) => void;
  onDuplicates: (value: JetPractice["strategia_duplicati"]) => void;
  onConfirmMapping: () => void;
  onApplyProfile: () => void;
  onCreateProfile: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(profiles.length === 0);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    setCreating(profiles.length === 0);
    setEditing(false);
  }, [selectedSource?.id, profiles.length]);

  const isProfileFile =
    selectedSource?.formato === "txt" || selectedSource?.formato === "pdf";
  const needsConfig =
    selectedSource &&
    selectedSource.attiva &&
    (selectedSource.stato !== "pronta" || editing);
  const mappedCount = MAP_FIELDS.filter((f) => mapping[f]).length;
  const appliedProfile =
    profiles.find((p) => p.id === selectedSource?.profilo_estrazione_id) ||
    txtInspection?.profilo ||
    null;

  const takeFiles = (list: FileList | File[] | null | undefined) => {
    if (!list || (list instanceof FileList ? list.length === 0 : list.length === 0)) {
      return;
    }
    onUpload(list);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    takeFiles(e.dataTransfer.files);
  };

  return (
    <JetSection
      icon="upload_file"
      title="Sorgente libro giornale"
      hint=".xlsx, .txt o .pdf testuale"
      accent="orange"
      trailing={
        sources.length > 0 ? (
          <>
            <input
              ref={fileRef}
              multiple
              type="file"
              accept=".xlsx,.txt,.pdf"
              className="sr-only"
              onChange={(e) => {
                takeFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              className={jetGhostClass}
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="add" size="sm" />
              Aggiungi file
            </button>
          </>
        ) : null
      }
    >
      {sources.length === 0 ? (
        <DropZone
          busy={busy}
          dragging={dragging}
          setDragging={setDragging}
          onDrop={onDrop}
          onPick={takeFiles}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs notion-table">
              <thead>
                <tr className="bg-[#f7f6f3] text-[#787774] font-medium">
                  <th className="py-2 px-3">File</th>
                  <th className="py-2 px-3">Formato</th>
                  <th className="py-2 px-3 text-right">Righe</th>
                  <th className="py-2 px-3">Stato</th>
                  <th className="py-2 px-3">Inclusa</th>
                  <th className="py-2 px-3 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((source) => {
                  const st = sourceStatus(source.stato);
                  const selected = selectedSource?.id === source.id;
                  return (
                    <tr
                      key={source.id}
                      tabIndex={0}
                      className={selected ? "bg-[#f7f6f3]" : undefined}
                      onClick={() => onSelectSource(source)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectSource(source);
                        }
                      }}
                    >
                      <td className="py-2.5 px-3">
                        <span className="block truncate font-medium text-[#2f3437]">
                          {source.nome_originale}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#787774]">
                        {source.formato.toUpperCase()}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">
                        {source.numero_righe.toLocaleString("it-IT")}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge variant={st.variant}>{st.label}</StatusBadge>
                      </td>
                      <td
                        className="py-2.5 px-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Switch
                          hideLabel
                          label={`Includi ${source.nome_originale}`}
                          checked={source.attiva}
                          disabled={busy}
                          onChange={(next) => onToggleActive(source, next)}
                        />
                      </td>
                      <td
                        className="py-2.5 px-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <label className={`${jetGhostClass} cursor-pointer`}>
                            Sostituisci
                            <input
                              className="sr-only"
                              type="file"
                              accept=".xlsx,.txt,.pdf"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) onReplace(source, file);
                                event.target.value = "";
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            className={jetGhostClass}
                            onClick={() => onDelete(source)}
                          >
                            Elimina
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {sources.length > 1 && (
            <div className="px-4 py-3 border-t border-[#e9e8e4] flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-[#787774]">
                Righe identiche
                <select
                  value={practice.strategia_duplicati}
                  onChange={(e) =>
                    onDuplicates(
                      e.target.value as JetPractice["strategia_duplicati"],
                    )}
                  className={`${inputClass} w-56 h-8`}
                >
                  <option value="mantieni_tutti">Mantieni tutte</option>
                  <option value="scarta_identiche">Scarta duplicati identici</option>
                </select>
              </label>
            </div>
          )}

          {selectedSource && selectedSource.stato === "pronta" && !editing && (
            <div className="px-4 py-3 border-t border-[#e9e8e4] bg-[#f4faf5] flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#137333]">
                {isProfileFile
                  ? `Pronto${appliedProfile ? ` · profilo «${appliedProfile.nome}»` : ""}.`
                  : `Pronto · ${mappedCount} colonne mappate.`}
              </p>
              <button
                type="button"
                className={jetGhostClass}
                onClick={() => setEditing(true)}
              >
                Modifica configurazione
              </button>
            </div>
          )}

          {needsConfig && isProfileFile && txtInspection && (
            <div className="px-4 py-4 border-t border-[#e9e8e4] space-y-4">
              <details open className="group">
                <summary className="text-xs text-[#787774] cursor-pointer list-none flex items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                  <Icon
                    name="expand_more"
                    size="sm"
                    className="transition-transform group-open:rotate-180"
                  />
                  Anteprima · {txtInspection.codifica}
                </summary>
                <pre className="mt-2 max-h-28 overflow-auto rounded-md bg-[#f7f6f3] p-3 font-mono text-[11px] leading-5 text-[#37352f]">
                  <code>
                    {highlightedHeader}
                    {txtInspection.righe_esempio?.map((line, index) => (
                      <span key={index}>
                        {"\n"}
                        {line}
                      </span>
                    ))}
                  </code>
                </pre>
              </details>

              {txtInspection.profilo && !creating && (
                <p className="text-xs text-[#787774]">
                  Riconosciuto:{" "}
                  <strong className="text-[#37352f] font-medium">
                    {txtInspection.profilo.nome}
                  </strong>
                </p>
              )}

              {profiles.length > 0 && (
                <div
                  className="inline-flex p-0.5 rounded-md bg-[#f1f1ef] gap-0.5"
                  role="tablist"
                  aria-label="Come mappare il file"
                >
                  <ModeTab active={!creating} onClick={() => setCreating(false)}>
                    Usa profilo
                  </ModeTab>
                  <ModeTab active={creating} onClick={() => setCreating(true)}>
                    Nuovo profilo
                  </ModeTab>
                </div>
              )}

              {!creating && profiles.length > 0 ? (
                <div className="flex flex-wrap items-end gap-2">
                  <label className="block min-w-[220px] flex-1">
                    <span className="block mb-1 text-xs text-[#787774]">
                      Profilo di estrazione
                    </span>
                    <select
                      value={selectedProfile}
                      onChange={(e) => setSelectedProfile(e.target.value)}
                      className={inputClass}
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
              ) : (
                <div className="space-y-3">
                  {profiles.length === 0 && (
                    <p className="text-xs text-[#787774]">
                      Nessun profilo in archivio. Definisci le posizioni una volta,
                      poi lo riusi sui prossimi file.
                    </p>
                  )}
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="block min-w-[220px] flex-1 max-w-sm">
                      <span className="block mb-1 text-xs text-[#787774]">
                        Nome profilo
                      </span>
                      <input
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        className={inputClass}
                        placeholder="Es. Giornale Zucchetti 2026"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busy || !profileName.trim()}
                      onClick={onCreateProfile}
                      className={jetPrimaryClass}
                    >
                      Salva e applica
                    </button>
                  </div>
                  <p className="text-[11px] text-[#9b9a97]">
                    Inizio e fine sono posizioni carattere sulla riga. Il focus
                    evidenzia l’intervallo nell’anteprima.
                  </p>
                  <div className="overflow-x-auto rounded-md border border-[#e9e8e4]">
                    <table className="w-full border-collapse text-left text-xs notion-table">
                      <thead>
                        <tr className="bg-[#f7f6f3] text-[#787774] font-medium">
                          <th className="py-2 px-3">Campo</th>
                          <th className="py-2 px-3 w-28">Inizio</th>
                          <th className="py-2 px-3 w-28">Fine (esclusa)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MAP_FIELDS.map((field) => (
                          <tr key={field}>
                            <td className="py-2 px-3 text-[#37352f]">
                              {FIELD_LABELS[field]}
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                aria-label={`${FIELD_LABELS[field]} inizio`}
                                type="number"
                                min="0"
                                value={positions[field]?.start || ""}
                                onFocus={() => setHighlightField(field)}
                                onChange={(e) =>
                                  setPositions({
                                    ...positions,
                                    [field]: {
                                      start: e.target.value,
                                      end: positions[field]?.end || "",
                                    },
                                  })}
                                className={`${inputClass} h-8`}
                              />
                            </td>
                            <td className="py-1.5 px-3">
                              <input
                                aria-label={`${FIELD_LABELS[field]} fine`}
                                type="number"
                                min="1"
                                value={positions[field]?.end || ""}
                                onFocus={() => setHighlightField(field)}
                                onChange={(e) =>
                                  setPositions({
                                    ...positions,
                                    [field]: {
                                      start: positions[field]?.start || "",
                                      end: e.target.value,
                                    },
                                  })}
                                className={`${inputClass} h-8`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {needsConfig && !isProfileFile && headers.length > 0 && (
            <div className="px-4 py-4 border-t border-[#e9e8e4] space-y-3">
              <p className="text-xs text-[#787774]">
                Abbina le colonne del file ai campi JET.
              </p>
              <div className="overflow-x-auto rounded-md border border-[#e9e8e4]">
                <table className="w-full border-collapse text-left text-xs notion-table">
                  <thead>
                    <tr className="bg-[#f7f6f3] text-[#787774] font-medium">
                      <th className="py-2 px-3">Campo JET</th>
                      <th className="py-2 px-3">Colonna nel file</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MAP_FIELDS.map((field) => (
                      <tr key={field}>
                        <td className="py-2 px-3">{FIELD_LABELS[field]}</td>
                        <td className="py-1.5 px-3">
                          <select
                            value={mapping[field] || ""}
                            onChange={(e) => {
                              const next = { ...mapping };
                              if (e.target.value) next[field] = e.target.value;
                              else delete next[field];
                              setMapping(next);
                            }}
                            className={`${inputClass} h-8`}
                          >
                            <option value="">Non mappato</option>
                            {headers.map((h) => (
                              <option key={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={onConfirmMapping}
                className={jetPrimaryClass}
              >
                Conferma mappatura
              </button>
            </div>
          )}

          {selectedSource && !selectedSource.attiva && (
            <p className="px-4 py-3 border-t border-[#e9e8e4] text-xs text-[#787774]">
              Fonte esclusa dall’analisi. Riattivala con l’interruttore Inclusa.
            </p>
          )}
        </>
      )}
    </JetSection>
  );
}

function DropZone({
  busy,
  dragging,
  setDragging,
  onDrop,
  onPick,
}: {
  busy: boolean;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  onDrop: (e: DragEvent) => void;
  onPick: (files: FileList) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="p-4">
      <input
        ref={ref}
        multiple
        type="file"
        accept=".xlsx,.txt,.pdf"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) onPick(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => ref.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full rounded-md border border-dashed px-4 py-10 text-center cursor-pointer transition-colors disabled:opacity-50 ${
          dragging
            ? "border-[#2f3437] bg-[#f7f6f3]"
            : "border-[#e9e8e4] hover:bg-[#faf9f7]"
        }`}
      >
        <span className="mx-auto mb-2 w-8 h-8 rounded bg-[#fdecc8] text-[#d9730d] flex items-center justify-center">
          <Icon name="upload_file" size="sm" />
        </span>
        <span className="block text-sm font-medium text-[#2f3437]">
          Carica libro giornale
        </span>
        <span className="block mt-1 text-xs text-[#9b9a97]">
          Trascina qui oppure clicca · .xlsx, .txt, .pdf testuale
        </span>
      </button>
    </div>
  );
}
