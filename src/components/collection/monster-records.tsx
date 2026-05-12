import { ShieldCheck, Skull } from "lucide-react";

import type { CollectionModel } from "@/server/collection/collection-service";

type MonsterRecordsProps = {
  collection: CollectionModel;
};

export function MonsterRecords({ collection }: MonsterRecordsProps) {
  return (
    <section className="collection-panel" aria-label="怪兽图鉴和通关记录">
      <div className="collection-panel__heading">
        <Skull aria-hidden="true" size={19} />
        <div>
          <p className="section-kicker">Monster Log</p>
          <h2>怪兽图鉴</h2>
        </div>
      </div>

      <div className="monster-record-list">
        {collection.monsterRecords.length > 0 ? (
          collection.monsterRecords.map((item) => (
            <article className="monster-record-card" key={item.id}>
              <div>
                <span>{item.level}</span>
                <strong>{item.monsterName}</strong>
                <p>{item.title}</p>
              </div>
              <small>
                <ShieldCheck aria-hidden="true" size={15} />
                {item.status === "completed" ? "已通关" : "战斗中"} · 救援 {item.rescueCount}
              </small>
            </article>
          ))
        ) : (
          <div className="collection-empty">
            <ShieldCheck aria-hidden="true" size={20} />
            <span>完成一次副本挑战后，怪兽记录会出现在这里。</span>
          </div>
        )}
      </div>
    </section>
  );
}
