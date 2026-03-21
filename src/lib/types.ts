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
  standards: string[];  // selected achievement standard codes
  domain: string;       // 평가영역 (e.g. 읽기)
  element: string;      // 평가요소 (e.g. 책을 읽고 글의 구조 파악하기)
  methods: string[];    // 평가방법
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
