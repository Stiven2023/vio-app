import { Fira_Code as FontMono, Inter as FontSans } from "next/font/google";

// Tipografía recomendada para Viomar: 'Montserrat' y 'Inter' (moderna, legible, profesional)
export const viomarFonts = [
  {
    name: "Montserrat",
    url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap",
    css: "font-family: 'Montserrat', sans-serif;",
  },
  {
    name: "Inter",
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap",
    css: "font-family: 'Inter', sans-serif;",
  },
];

export const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
});
