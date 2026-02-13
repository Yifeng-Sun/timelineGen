
import React, { useState } from 'react';
import { TimelineItem } from '../types';

type AddItemType = 'event' | 'period' | 'note';

interface AddItemPanelProps {
  onAdd: (item: TimelineItem) => void;
  onClose: () => void;
}

const typeOptions: { value: AddItemType; label: string }[] = [
  { value: 'event', label: 'Event' },
  { value: 'period', label: 'Period' },
  { value: 'note', label: 'Note' },
];

const AddItemPanel: React.FC<AddItemPanelProps> = ({ onAdd, onClose }) => {
  const [addType, setAddType] = useState<AddItemType>('event');
  const [addName, setAddName] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addEndDate, setAddEndDate] = useState('');

  const canSubmit = addName.trim() && addDate.trim() && (addType !== 'period' || addEndDate.trim());

  const handleSubmit = () => {
    if (!canSubmit) return;
    const id = Math.random().toString(36).substr(2, 9);
    let newItem: TimelineItem;

    if (addType === 'event') {
      newItem = { id, label: addName.trim(), date: addDate.trim(), type: 'event' };
    } else if (addType === 'period') {
      newItem = { id, label: addName.trim(), startDate: addDate.trim(), endDate: addEndDate.trim(), type: 'period' };
    } else {
      newItem = { id, label: addName.trim(), date: addDate.trim(), type: 'note' };
    }

    onAdd(newItem);
    setAddName('');
    setAddDate('');
    setAddEndDate('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canSubmit) handleSubmit();
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="absolute bottom-16 right-4 z-40 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 p-4 space-y-3 animate-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">Add Item</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
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
        placeholder="Name"
        value={addName}
        onChange={(e) => setAddName(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
      <input
        type="text"
        placeholder={addType === 'period' ? 'Start date (e.g. Jan 1, 2024)' : 'Date (e.g. Jan 1, 2024)'}
        value={addDate}
        onChange={(e) => setAddDate(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
      />
      {addType === 'period' && (
        <input
          type="text"
          placeholder="End date (e.g. Jun 30, 2024)"
          value={addEndDate}
          onChange={(e) => setAddEndDate(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      )}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Add {addType.charAt(0).toUpperCase() + addType.slice(1)}
      </button>
    </div>
  );
};

export default AddItemPanel;
