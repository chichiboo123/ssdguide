export interface AchievementStandard {
  코드: string;
  내용: string;
  교육과정: string;
  학년군: string;
  교과: string;
  과목: string;
  영역: string;
}

export interface BasketItem extends AchievementStandard {}

export interface LessonProcessStep {
  id: string;
  period: string;
  topic: string;
  content: string;
  note: string;
}

export interface EvaluationEntry {
  id: string;
  subject: string;
  methods: string[];
  content: string;
}

export interface MaterialEntry {
  id: string;
  type: 'text' | 'link' | 'image';
  content: string;
  title?: string;
  url?: string;
  fileData?: string;
  fileName?: string;
}

export interface LessonDesign {
  title: string;
  author?: string;
  standards: BasketItem[];
  intent: string;
  objective: string;
  process: string;
  useTableMode?: boolean;
  processSteps?: LessonProcessStep[];
  evaluations: EvaluationEntry[];
  materials: MaterialEntry[];
}
