/** Relative assets work at both a domain root and a GitHub Pages repository path. */
export function asset(path:string){return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;}
