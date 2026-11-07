import { asset } from './components';

export default function AtmosphereCollage() {
  return <figure className="atmosphere-collage reveal">
    <img className="collage-image collage-table" src={asset('generated/scene/interior-table.jpg')} alt="Концепция: столик у окна с синим диваном и бордовым цветком" loading="lazy" width="1086" height="1448"/>
    <img className="collage-image collage-main" src={asset('generated/scene/interior-main.jpg')} alt="Концепция зала «Ялты»: солнечный свет, дерево и синие акценты" loading="lazy" width="1448" height="1086"/>
    <img className="collage-image collage-detail" src={asset('generated/scene/interior-detail.jpg')} alt="Концепция кофейного уголка с синей плиткой и тёплым деревом" loading="lazy" width="1086" height="1448"/>
    <figcaption>Образ будущей «Ялты»</figcaption>
  </figure>;
}
