import { BookMarked, Gem } from "lucide-react";

import type { CollectionModel } from "@/server/collection/collection-service";

type EquipmentAlbumProps = {
  collection: CollectionModel;
};

export function EquipmentAlbum({ collection }: EquipmentAlbumProps) {
  return (
    <section className="collection-panel" aria-label="表达装备册">
      <div className="collection-panel__heading">
        <Gem aria-hidden="true" size={19} />
        <div>
          <p className="section-kicker">Equipment</p>
          <h2>表达装备册</h2>
        </div>
      </div>

      <div className="equipment-album-grid">
        {collection.equipment.length > 0 ? (
          collection.equipment.map((item) => (
            <article className="equipment-album-card" key={item.id}>
              <span>{item.rarity}</span>
              <h3>{item.equipmentName}</h3>
              <p>{item.expression}</p>
              <small>{item.meaningZh}</small>
            </article>
          ))
        ) : (
          <div className="collection-empty">
            <BookMarked aria-hidden="true" size={20} />
            <span>通关或收藏表达后，这里会出现可带进战斗的装备。</span>
          </div>
        )}
      </div>
    </section>
  );
}
