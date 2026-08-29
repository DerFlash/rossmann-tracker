const scannerSourcePaths = new Set([
  "scripts/check-publication-hygiene.mjs",
  "scripts/publication-hygiene-rules.mjs",
]);

const personalPublicationValues = [
  { label: "absoluter Benutzerpfad", pattern: /(?:\/Users|\/home)\/[A-Za-z0-9._-]+(?:\/|\b)|C:\\Users\\[A-Za-z0-9._-]+(?:\\|\b)/i },
  { label: "Mailadresse", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: "private Netzwerkadresse", pattern: /\b(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})\b/ },
];

const secretPatterns = [
  { label: "Telegram-Bot-Token", pattern: /\b\d{8,}:[A-Za-z0-9_-]{35}\b/ },
  { label: "Telegram-Chat-ID", pattern: /(?:TELEGRAM_CHAT_ID|["']?chat[_-]?id["']?)\s*[:=]\s*["']?-?\d{6,}["']?/i },
  { label: "GitHub-Token", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/ },
  { label: "npm-Token", pattern: /\bnpm_[A-Za-z0-9]{30,}\b/ },
  { label: "AWS-Zugriffsschlüssel", pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { label: "Slack-Webhook", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/ },
  { label: "JWT", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { label: "Zugangsdaten in URL", pattern: /https?:\/\/[^\s/:]+:[^\s/@]+@/ },
  {
    label: "fest eingetragener sensibler Wert",
    pattern: /(?:api[_-]?key|client[_-]?secret|password|passwd|bot[_-]?token|access[_-]?token)["']?\s*[:=]\s*["'][A-Za-z0-9_./+=:-]{12,}["']/i,
  },
  {
    label: "fest eingetragener sensibler Wert",
    pattern: /(?:api[_-]?key|client[_-]?secret|password|passwd|bot[_-]?token|access[_-]?token)["']?\s*[:=]\s*(?=[A-Za-z0-9_./+=:-]{20,}(?=\s|$|[,}]))(?=[A-Za-z0-9_./+=:-]*\d)[A-Za-z0-9_./+=:-]+/i,
    pathPattern: /(?:^|\/)(?:\.env(?:\..+)?|[^/]+\.(?:ya?ml|properties|conf|ini))$/i,
  },
  {
    label: "sensibler Umgebungswert",
    pattern: /(?:^|\n)\s*(?:API_KEY|CLIENT_SECRET|PASSWORD|PASSWD|TELEGRAM_BOT_TOKEN|ACCESS_TOKEN)\s*=\s*(?!\$\{|<|example|placeholder|test)[^\s#]{12,}/i,
  },
  { label: "privater Schlüssel", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const publicationRules = [
  {
    label: "veraltete öffentliche Repository-Zielkennung",
    pattern: /DerFlash\/rossmann-dan-pruefer/i,
    allowedPaths: new Set(["docs/publication-boundary.md"]),
  },
  {
    label: "veralteter GitHub-Wiki-Link",
    pattern: /github\.com\/DerFlash\/rossmann-(?:dan-pruefer|store-tracker)\/wiki/i,
  },
  {
    label: "veralteter sichtbarer Projektname",
    pattern: /Rossmann DAN-(?:Tracker|Prüfer)/,
  },
];

export function contentFindings(path, content) {
  const activeRules = scannerSourcePaths.has(path)
    ? secretPatterns
    : [...personalPublicationValues, ...secretPatterns, ...publicationRules];
  return activeRules
    .filter((rule) => (
      !rule.allowedPaths?.has(path)
      && (!rule.pathPattern || rule.pathPattern.test(path))
      && rule.pattern.test(content)
    ))
    .map((rule) => rule.label);
}

export function isForbiddenTrackedPath(path) {
  const segments = String(path).split("/");
  const basename = segments.at(-1) || "";
  if (segments.some((segment) => ["data", "browser-data", "upload", "backups", "exports"].includes(segment))) {
    return true;
  }
  if (/^\.env(?:\..+)?$/.test(basename) && basename !== ".env.example") return true;
  if (basename === "config.json") return true;
  if (/^(?:rossmann-debug\.(?:png|json)|\.DS_Store)$/.test(basename)) return true;
  return /\.(?:log|zip)$/i.test(basename);
}
