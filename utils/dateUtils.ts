
export const parseDate = (dateStr: string): Date => {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

export const getMinMaxDates = (items: any[]) => {
  if (items.length === 0) return { min: new Date(), max: new Date() };

  const dates: number[] = [];
  items.forEach(item => {
    if (item.type === 'event') {
      dates.push(parseDate(item.date).getTime());
    } else {
      dates.push(parseDate(item.startDate).getTime());
      dates.push(parseDate(item.endDate).getTime());
    }
  });

  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));

  // Add some padding
  const range = max.getTime() - min.getTime();
  const padding = range * 0.1 || 86400000 * 30; // 10% or 30 days

  return {
    min: new Date(min.getTime() - padding),
    max: new Date(max.getTime() + padding)
  };
};
