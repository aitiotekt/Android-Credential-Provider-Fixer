import { en } from "./en";
import { zh } from "./zh";

export const translations = { en, zh } as const;

export type Locale = keyof typeof translations;
type DeepString<T> = {
	[Key in keyof T]: T[Key] extends string ? string : DeepString<T[Key]>;
};
export type Messages = DeepString<typeof en>;
