function normalizeSalaryRange(salaryString: string | undefined | null): {
  minSalary: number;
  maxSalary: number;
  midpoint: number;
  original: string;
} | null {
  if (!salaryString || typeof salaryString !== 'string') return null;

  // cleanup
  const cleaned = salaryString.trim().toLowerCase();

  const numberRegex = /\$?([0-9,]+(?:\.[0-9]{2})?)/g;
  const numbers = [];
  let match;

  while ((match = numberRegex.exec(cleaned)) !== null) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    numbers.push(num);
  }

  if (numbers.length === 0) return null;

  const isHourly = cleaned.includes('/hr') || cleaned.includes('hour') || cleaned.includes('hourly');

  const HOURS_PER_YEAR = 2080;

  const [min, max] = numbers.slice(0, 2);
  const minSalary = isHourly ? min * HOURS_PER_YEAR : min;
  const maxSalary = isHourly ? max * HOURS_PER_YEAR : max;

  return {
    minSalary: Math.round(minSalary),
    maxSalary: Math.round(maxSalary),
    midpoint: Math.round((minSalary + maxSalary) / 2),
    original: salaryString,
  };
}

export { normalizeSalaryRange };
