export function rnd(n: number): number { return Math.floor(Math.random() * n); }
export function pick<T>(a: readonly T[]): T { return a[rnd(a.length)]; }
export function pad2(n: number): string { return String(n).padStart(2, "0"); }
export function pad3(n: number): string { return String(n).padStart(3, "0"); }
export function slug(s: string): string {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "");
}
export const FIRST_NAMES = [
    "Mar\u00EDa",
    "Juan",
    "Carlos",
    "Ana",
    "Pedro",
    "Laura",
    "Miguel",
    "Isabel",
    "David",
    "Sof\u00EDa",
    "Alejandro",
    "Elena",
    "Francisco",
    "Carmen",
    "Daniel",
    "Patricia",
    "Antonio",
    "Marta",
    "James",
    "Emma",
    "Oliver",
    "Sophia",
    "Liam",
    "Isabella",
    "Noah",
    "Ava",
    "Lucas",
    "Mia",
    "Ethan",
    "Charlotte",
] as const;
export const LAST_NAMES = [
    "Garc\u00EDa",
    "Mart\u00EDnez",
    "L\u00F3pez",
    "S\u00E1nchez",
    "Gonz\u00E1lez",
    "Rodr\u00EDguez",
    "Fern\u00E1ndez",
    "P\u00E9rez",
    "G\u00F3mez",
    "D\u00EDaz",
    "Torres",
    "Jim\u00E9nez",
    "Ruiz",
    "Hern\u00E1ndez",
    "Moreno",
    "Mu\u00F1oz",
    "\u00C1lvarez",
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Miller",
    "Davis",
    "Wilson",
    "Taylor",
    "Anderson",
    "Thomas",
    "Jackson",
    "White",
] as const;
export const LOREM_SENTENCES = [
    "Lorem ipsum dolor sit amet consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam quis nostrud exercitation ullamco laboris.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.",
    "Excepteur sint occaecat cupidatat non proident sunt in culpa qui officia.",
    "Deserunt mollit anim id est laborum sed perspiciatis unde omnis iste.",
    "Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
    "Neque porro quisquam est qui dolorem ipsum quia dolor sit amet.",
    "Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam.",
    "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis.",
] as const;
export const EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "empresa.es", "correo.com"] as const;
export const URL_PATHS = ["/blog", "/contact", "/about", "/products", "/services", "/news", "/help"] as const;
export const CITIES = [
    "Madrid",
    "Barcelona",
    "Valencia",
    "Sevilla",
    "Bilbao",
    "M\u00E1laga",
    "Zaragoza",
    "Murcia",
    "Granada",
    "Vigo",
    "Londres",
    "Par\u00EDs",
    "Berl\u00EDn",
    "Roma",
    "Lisboa",
    "\u00C1msterdam",
    "Nueva York",
    "Tokio",
    "Ciudad de M\u00E9xico",
    "Buenos Aires",
    "Bogot\u00E1",
    "Santiago",
] as const;
export const COUNTRIES = [
    "Espa\u00F1a",
    "Francia",
    "Alemania",
    "Italia",
    "Portugal",
    "Reino Unido",
    "Pa\u00EDses Bajos",
    "M\u00E9xico",
    "Argentina",
    "Chile",
    "Colombia",
    "Per\u00FA",
    "Estados Unidos",
    "Canad\u00E1",
    "Brasil",
    "Jap\u00F3n",
    "Australia",
    "Irlanda",
] as const;
export const COMPANIES = [
    "Acme",
    "Globex",
    "Initech",
    "Umbrella",
    "Soylent",
    "Vandelay",
    "Hooli",
    "TecnoSoluciones",
    "DataCorp",
    "NubeSistemas",
    "InnovaLab",
    "RedGlobal",
    "SoftPuente",
    "OmniTech",
] as const;
export const STREETS = [
    "Calle Mayor",
    "Gran V\u00EDa",
    "Avenida de la Constituci\u00F3n",
    "Paseo de Gracia",
    "Calle del Sol",
    "Plaza Espa\u00F1a",
    "Ronda Norte",
    "Avenida del Puerto",
    "Calle de Alcal\u00E1",
    "Rambla Catalunya",
] as const;
export const COLOR_NAMES = ["rojo", "azul", "verde", "amarillo", "negro", "blanco", "gris", "naranja", "morado", "rosa", "turquesa", "marr\u00F3n"] as const;
export const STATUSES = ["activo", "inactivo", "pendiente", "completado", "cancelado", "en_proceso", "borrador"] as const;
export const JOB_TITLES = ["Desarrollador", "Dise\u00F1adora", "Gerente", "Analista", "Comercial", "Contable", "Ingeniero", "Consultora", "Directora", "T\u00E9cnico"] as const;
export const WORDS = ["alfa", "beta", "delta", "nodo", "dato", "item", "base", "flujo", "tarea", "campo", "valor", "bloque", "linea", "grupo", "lote"] as const;
export function fullName(): string { return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; }
export function email(): string { return `${slug(pick(FIRST_NAMES))}${rnd(99)}@${pick(EMAIL_DOMAINS)}`; }
export function phoneEs(): string { return `+34 ${6 + rnd(3)}${Array.from({ length: 8 }, () => rnd(10)).join("")}`; }
export function loremText(): string { return Array.from({ length: 2 + rnd(4) }, () => pick(LOREM_SENTENCES)).join(" "); }
export function urlDemo(): string { return `https://${pick(["example.com", "test.org", "demo.net", "sample.io"])}${pick(URL_PATHS)}`; }
export function colorHex(): string { return "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0"); }
export function ipv4(): string { return `${rnd(254) + 1}.${rnd(256)}.${rnd(256)}.${rnd(254) + 1}`; }
export function ipv6(): string { return Array.from({ length: 8 }, () => Math.floor(Math.random() * 65536).toString(16).padStart(4, "0")).join(":"); }
export function ibanEs(): string { return "ES" + Array.from({ length: 20 }, () => rnd(10)).join(""); }
