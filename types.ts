export interface UserData {
  photo: string | null; // Base64
  userName: string;
  worstMoment: string;
  bestMoment: string;
}

export interface ComicPages {
  cover: string | null;
  p1: string | null;
  p2: string | null;
  p3: string | null;
  p4: string | null;
  backCover: string | null;
  captions: {
    p1: string;
    p2: string;
    p3: string;
    p4: string;
  };
}

export enum AppStep {
  WELCOME,
  CAMERA,
  FORM,
  GENERATING,
  PREVIEW
}
