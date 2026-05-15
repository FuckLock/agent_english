import { Gem, PackageOpen } from "lucide-react";

import type { SettlementRewardModel } from "@/server/game/reward-service";

type EquipmentDropCardProps = {
  settlement: SettlementRewardModel;
};

export function EquipmentDropCard({ settlement }: EquipmentDropCardProps) {
  const drop = settlement.equipmentDrop;

  return (
    <section className="settlement-card equipment-drop" aria-label="装备掉落">
      <div className="settlement-card__title">
        <Gem aria-hidden="true" size={18} />
        <strong>装备掉落</strong>
      </div>

      {drop ? (
        <div className="equipment-drop__item">
          {drop.imageUrl ? (
            <img alt="" className="equipment-drop__art" src={drop.imageUrl} />
          ) : null}
          <span>{drop.newlyCreated ? "新装备" : "已拥有"}</span>
          <h2>{drop.equipmentName}</h2>
          <p>{drop.expression}</p>
          <small>
            {drop.meaningZh} · {drop.rarity}
          </small>
        </div>
      ) : (
        <div className="equipment-drop__empty">
          <PackageOpen aria-hidden="true" size={20} />
          <span>这场没有生成可装备表达。</span>
        </div>
      )}
    </section>
  );
}
