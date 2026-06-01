export function epley1RM(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}
