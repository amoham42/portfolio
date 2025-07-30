import './style.css';
import { Scene } from './js/Scene.js';

Ammo().then((lib) => {
  const scene = new Scene(lib);
  console.log(scene);
});