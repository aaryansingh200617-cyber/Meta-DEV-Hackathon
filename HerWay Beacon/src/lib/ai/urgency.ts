const URGENT = /\b(help me|i'?m in danger|in danger|being followed|someone is following|following me|stalk(ing|ed)?|unsafe|not safe|scared|frightened|attack(ed|ing)?|harass(ed|ing|ment)?|threat(en|ening|ened)?|grabbed|emergency|kidnap|assault)/i;

/** Deterministic urgency check that runs BEFORE any AI call, so emergency guidance never depends on a model. */
export const looksUrgent = (text: string) => URGENT.test(text);
