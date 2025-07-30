import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCardNumber(index: number): string {
  return `卡片 #${index + 1}`;
}

export function getCardColor(index: number): string {
  const colors = [
    "bg-blue-100 text-blue-800",
    "bg-emerald-100 text-emerald-800",
    "bg-amber-100 text-amber-800",
    "bg-purple-100 text-purple-800",
    "bg-pink-100 text-pink-800",
    "bg-indigo-100 text-indigo-800"
  ];
  return colors[index % colors.length];
}

export function validateJsonFile(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    if (file.type !== "application/json") {
      resolve(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const jsonData = JSON.parse(e.target?.result as string);
        const isValid = jsonData && 
          jsonData.cards && 
          Array.isArray(jsonData.cards) &&
          jsonData.cards.every((card: any) => 
            card.thai && 
            card.chinese && 
            card.pronunciation && 
            card.example && 
            card.example_translation
          );
        resolve(isValid);
      } catch {
        resolve(false);
      }
    };
    reader.readAsText(file);
  });
}
