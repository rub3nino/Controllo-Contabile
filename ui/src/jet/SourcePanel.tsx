/**
 * Sorgente libro giornale: carica e sceglie la fonte.
 * Mappatura e profilo si aprono nel pannello a destra.
 */

import { useRef, useState, type DragEvent } from "react";
import { Icon, StatusBadge, Switch } from "../components";
import {
  JetSection,
  jetGhostClass,
  jetInputClass,
  jetPrimaryClass,
} from "./NotionChrome";
import type { JetPractice, JetSource } from "./api";

const inputClass = jetInputClass;

function sourceStatus(stato: JetSource["stato"]): {
  variant: "success" | "warning" | "error" | "neutral" | "info";
  label: string;
} {
  if (stato === "pronta") return { variant: "success", label: "Pronta" };
  if (stato === "errore") return { variant: "error", label: "Errore" };
  if (stato === "esclusa") return { variant: "neutral", label: "Esclusa" };
  return { variant: "warning", label: "Da configurare" };
}

export function SourcePanel({
  practice,
  sources,
  selectedSource,
  busy,
  onUpload,
  onSelectSource,
  onToggleActive,
  onReplace,
  onDelete,
  onDuplicates,
  onOpenMapping,
}: {
  practice: JetPractice;
  sources: JetSource[];
  selectedSource: JetSource | null;
  busy: boolean;
  onUpload: (files: FileList | File[]) => void;
  onSelectSource: (source: JetSource) => void;
  onToggleActive: (source: JetSource, attiva: boolean) => void;
  onReplace: (source: JetSource, file: File) => void;
  onDelete: (source: JetSource) => void;
  onDuplicates: (value: JetPractice["strategia_duplicati"]) => void;
  onOpenMapping: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const isProfileFile =
    selectedSource?.formato === "txt" || selectedSource?.formato === "pdf";
  const mappedCount = Object.keys(selectedSource?.mappatura || {}).length;
  const needsConfig =
    selectedSource &&
    selectedSource.attiva &&
    selectedSource.stato !== "pronta";

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

          {selectedSource && selectedSource.stato === "pronta" && (
            <div className="px-4 py-3 border-t border-[#e9e8e4] bg-[#f4faf5] flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#137333]">
                {isProfileFile
                  ? "Pronto · profilo applicato."
                  : `Pronto · ${mappedCount} colonne mappate.`}
              </p>
              <button
                type="button"
                className={jetGhostClass}
                onClick={onOpenMapping}
              >
                {isProfileFile ? "Modifica profilo" : "Modifica mappatura"}
              </button>
            </div>
          )}

          {needsConfig && (
            <div className="px-4 py-3 border-t border-[#e9e8e4] bg-[#fffcf5] flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[#9f6b00]">
                {selectedSource.stato === "errore"
                  ? selectedSource.errore || "Fonte in errore: ricontrolla la mappatura."
                  : isProfileFile
                  ? "Manca il profilo di estrazione. Aprilo a destra e usa la i su ogni campo."
                  : "Manca la mappatura colonne. Aprila a destra e usa la i su ogni campo."}
              </p>
              <button
                type="button"
                className={jetPrimaryClass}
                onClick={onOpenMapping}
              >
                {isProfileFile ? "Apri profilo" : "Apri mappatura"}
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
