import { extractText, getDocumentProxy } from "unpdf";

export type ParsedResume = {
  text: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  summary: string | null;
  skills: string[];
};

const SKILL_LIBRARY = [
  "Java", "Spring", "Spring Boot", "Kafka", "PostgreSQL", "MySQL", "Oracle",
  "Kubernetes", "Docker", "AWS", "Azure", "GCP", "Terraform",
  "Python", "Django", "Flask", "FastAPI", "Pandas", "PyTorch", "TensorFlow",
  "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular", "Node.js",
  "Tailwind", "GraphQL", "REST", "gRPC",
  "Go", "Rust", "C#", ".NET", "Ruby", "Rails",
  "Linux", "CI/CD", "Jenkins", "GitHub Actions",
  "Agile", "Scrum", "JIRA",
];

export async function parseResume(buffer: Buffer): Promise<ParsedResume> {
  const u8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const pdf = await getDocumentProxy(u8);
  const { text } = await extractText(pdf, { mergePages: true });
  const flat = (Array.isArray(text) ? text.join("\n") : text).replace(/\r/g, "");

  const email = (flat.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [null])[0];
  const phone = (flat.match(/(?:\+?\d[\d\s().-]{8,}\d)/) || [null])[0];

  // Name = first non-empty line that isn't an email/phone/url, max 4 words.
  const lines = flat.split("\n").map((l) => l.trim()).filter(Boolean);
  let fullName: string | null = null;
  for (const line of lines.slice(0, 8)) {
    if (/@/.test(line) || /https?:\/\//i.test(line) || /\d{3,}/.test(line)) continue;
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4 && /^[A-Za-z][A-Za-z .'-]*$/.test(line)) {
      fullName = line;
      break;
    }
  }

  const titleLine = lines.find((l) =>
    /(engineer|developer|architect|manager|lead|consultant|analyst|designer|specialist|director)/i.test(l) &&
    l.length < 120,
  );

  const summaryLine = lines.find((l) => l.length > 60 && l.length < 400);

  // Location heuristic: line containing common geographies or a postal pattern
  const locationLine = lines.find((l) =>
    /(India|Germany|United States|USA|UK|Canada|Bengaluru|Bangalore|Mumbai|Delhi|Pune|Hyderabad|Munich|Berlin|London|New York|San Francisco)/i.test(l) &&
    l.length < 120,
  );

  const skills = Array.from(
    new Set(
      SKILL_LIBRARY.filter((s) => new RegExp(`(?:^|[^A-Za-z])${escapeRe(s)}(?:[^A-Za-z]|$)`, "i").test(flat)),
    ),
  ).slice(0, 30);

  return {
    text: flat,
    fullName,
    email,
    phone: phone ? phone.replace(/\s+/g, " ").trim() : null,
    location: locationLine ?? null,
    currentTitle: titleLine ?? null,
    currentCompany: null,
    summary: summaryLine ?? null,
    skills,
  };
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
