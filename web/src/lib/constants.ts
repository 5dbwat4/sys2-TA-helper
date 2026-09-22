export const TA_MAPPING: Record<string, string> = {
  '3240102049': '5dbwat4',
  '3240102120': 'AlabTNT',
  '3240102072': 'Taolu',
};

export const TEACHER_CREDENTIALS = {
  allowedNames: ['吴磊', '卢立'],
  fixedPassword: 'ZJU-sys2_fa26@WL',
};

export function getDisplayName(studentId: string, role?: string, name?: string): string {
  if (TA_MAPPING[studentId]) {
    return TA_MAPPING[studentId];
  }
  return name || studentId;
}
