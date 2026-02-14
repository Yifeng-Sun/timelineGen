
import React, { useState, useEffect } from 'react';
import { TimelineItem } from '../types';

type AddItemType = 'event' | 'period' | 'note';

interface AddItemPanelProps {
  items: TimelineItem[];
  setItems: React.Dispatch<React.SetStateAction<TimelineItem[]>>;
  onClose: () => void;
}

const typeOptions: { value: AddItemType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'period', label: 'Period' },
  { value: 'note', label: 'Note' },
];

// Convert datetime-local value to a readable date string
function formatDateTimeValue(val: string): string {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

// Convert items array to the JSON editor format
function itemsToJson(items: TimelineItem[]): string {
  const obj: Record<string, object> = {};
  items.forEach(item => {
    if (item.type === 'event') {
      obj[item.label] = { type: 'event', date: item.date };
    } else if (item.type === 'period') {
      obj[item.label] = { type: 'period', startDate: item.startDate, endDate: item.endDate };
    } else {
      obj[item.label] = { type: 'note', date: item.date };
    }
  });
  return JSON.stringify(obj, null, 2);
}

// Combine separate date and time values into a datetime-local string
function combineDatetime(date: string, time: string): string {
  if (!date) return '';
  return time ? `${date}T${time}` : `${date}T00:00`;
}

// Get the latest date from timeline items, then add 1 hour
function getDefaultAfterLast(items: TimelineItem[]): { date: string; time: string } {
  let latest = 0;
  for (const item of items) {
    if (item.type === 'period') {
      const t = new Date(item.endDate).getTime();
      if (t > latest) latest = t;
    } else {
      const t = new Date(item.date).getTime();
      if (t > latest) latest = t;
    }
  }
  const d = latest ? new Date(latest + 60 * 60 * 1000) : new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

const AddItemPanel: React.FC<AddItemPanelProps> = ({ items, setItems, onClose }) => {
  const defaults = getDefaultAfterLast(items);
  const [addType, setAddType] = useState<AddItemType>('event');
  const [addName, setAddName] = useState('');
  const [addDate, setAddDate] = useState(defaults.date);
  const [addTime, setAddTime] = useState(defaults.time);
  const [addEndDate, setAddEndDate] = useState('');
  const [addEndTime, setAddEndTime] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [jsonInput, setJsonInput] = useState(() => itemsToJson(items));

  useEffect(() => {
    setJsonInput(itemsToJson(items));
  }, [items]);

  const canSubmit = addName.trim() && addDate && (addType !== 'period' || addEndDate);

  const handleSubmit = () => {
    if (!canSubmit) return;
    const id = Math.random().toString(36).substr(2, 9);
    const dateStr = formatDateTimeValue(combineDatetime(addDate, addTime));
    const endDateStr = formatDateTimeValue(combineDatetime(addEndDate, addEndTime));
    let newItem: TimelineItem;

    if (addType === 'event') {
      newItem = { id, label: addName.trim(), date: dateStr, type: 'event' };
    } else if (addType === 'period') {
      newItem = { id, label: addName.trim(), startDate: dateStr, endDate: endDateStr, type: 'period' };
    } else {
      newItem = { id, label: addName.trim(), date: dateStr, type: 'note' };
    }

    setItems(prev => {
      const next = [...prev, newItem];
      const nextDefaults = getDefaultAfterLast(next);
      setAddDate(nextDefaults.date);
      setAddTime(nextDefaults.time);
      return next;
    });
    setAddName('');
    setAddEndDate('');
    setAddEndTime('');
  };

  const applyJson = () => {
    try {
      const data = JSON.parse(jsonInput);
      const newItems: TimelineItem[] = [];
      Object.entries(data).forEach(([label, value]: [string, any]) => {
        const id = Math.random().toString(36).substr(2, 9);
        if (value.type === 'period') {
          newItems.push({ id, label, startDate: value.startDate, endDate: value.endDate, type: 'period' });
        } else if (value.type === 'note') {
          newItems.push({ id, label, date: value.date, type: 'note' });
        } else {
          newItems.push({ id, label, date: value.date, type: 'event' });
        }
      });
      setItems(newItems);
    } catch (e) {
      alert("Invalid JSON format. Please check your syntax.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) handleSubmit();
    if (e.key === 'Escape') onClose();
  };

  const inputClass = "w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none";

  return (
    <div className="absolute bottom-16 right-4 z-40 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 space-y-3 animate-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">New Duckling</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 leading-none" title="Minimize">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="12" x2="13" y2="12" /></svg>
        </button>
      </div>

      <div className="flex gap-1">
        {typeOptions.map(opt => (
          <button
            key={opt.value}
            onClick={() => setAddType(opt.value)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition ${
              addType === opt.value
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="What happened at the pond?"
        value={addName}
        onChange={(e) => setAddName(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className={inputClass}
      />
      <div>
        <label className="block text-[10px] text-slate-400 mb-1">
          {addType === 'period' ? 'Start' : 'Date & Time'}
        </label>
        <div className="flex gap-2">
          <input
            type="date"
            value={addDate}
            onChange={(e) => setAddDate(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`${inputClass} min-w-0 flex-[3]`}
          />
          <input
            type="time"
            value={addTime}
            onChange={(e) => setAddTime(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`${inputClass} min-w-0 flex-[2]`}
          />
        </div>
      </div>
      {addType === 'period' && (
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">End</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={addEndDate}
              onChange={(e) => setAddEndDate(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} min-w-0 flex-[3]`}
            />
            <input
              type="time"
              value={addEndTime}
              onChange={(e) => setAddEndTime(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputClass} min-w-0 flex-[2]`}
            />
          </div>
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Add {addType.charAt(0).toUpperCase() + addType.slice(1)}
      </button>

      {/* Collapsible JSON editor */}
      <div className="border-t border-slate-200 pt-2">
        <button
          onClick={() => setShowJson(!showJson)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition w-full"
        >
          <svg
            className={`w-3 h-3 transition-transform ${showJson ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
          Quack in JSON
        </button>
        {showJson && (
          <div className="mt-2 space-y-2">
            <textarea
              className="w-full h-40 p-2 text-[10px] font-mono bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
            />
            <button
              onClick={applyJson}
              className="w-full bg-slate-900 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 transition shadow-sm"
            >
              Update Timeline
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddItemPanel;
