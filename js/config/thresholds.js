export const thresholds = [
  { max: 0.70, color: '#16a34a', label: '余裕（≦70%）' },
  { max: 0.80, color: '#f59e0b', label: '少し混雑（≦80%）' },
  { max: 0.90, color: '#fca5a5', label: '混雑（≦90%）' },
  { max: 1.00, color: '#dc2626', label: '大混雑（≦100%）' },
  { max: Infinity, color: '#9ca3af', label: 'データ不足/外れ値' }
];
