"use client";

import { useId, useState } from "react";

export function PlaceFilter({ name, label, presets, places, required = false }: {
  name: string;
  label: string;
  presets: string[];
  places: string[];
  required?: boolean;
}) {
  const [value, setValue] = useState("");
  const listId = useId();
  const suggestions = [...new Set([...presets, ...places])];

  return <div className="min-w-0">
    <label className="label">{label}
      <input name={name} className="field" list={listId} value={value}
        onChange={event => setValue(event.target.value)} maxLength={80} minLength={required ? 2 : undefined} required={required}
        placeholder="输入或选择地点" autoComplete="off" />
    </label>
    <datalist id={listId}>{suggestions.map(place => <option key={place} value={place} />)}</datalist>
    <div role="group" aria-label={`${label}快捷选项`} className="mt-2 flex flex-wrap gap-1.5">
      {(required ? presets : ["", ...presets]).map(place => <button key={place} type="button"
        aria-pressed={value === place} onClick={() => setValue(place)}
        className={`min-h-11 rounded-lg border px-2 text-xs transition ${value === place
          ? "border-blue-200 bg-blue-50 font-bold text-blue-700"
          : "border-slate-200 bg-white text-slate-500 hover:border-blue-300"}`}>
        {place || "不限"}
      </button>)}
    </div>
  </div>;
}
