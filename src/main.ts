import "./styles.css";
import { Game } from "./Game";

const canvas = document.getElementById("game") as HTMLCanvasElement;
new Game(canvas);
