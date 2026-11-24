import { Injectable } from "@angular/core";
import { contarHabiles, siguienteHabil, sumarHabiles } from "./dias-habiles";
export * from "./dias-habiles";
@Injectable({ providedIn: "root" })
export class DiasHabilesService {
    contar = contarHabiles;
    sumar = sumarHabiles;
    siguiente = siguienteHabil;
}
