import { WandSparkles } from "lucide-react";

import type { BattleEquipmentView } from "@/server/battles/battle-model";

type EquipmentSkillBarProps = {
  equipment: BattleEquipmentView[];
};

export function EquipmentSkillBar({ equipment }: EquipmentSkillBarProps) {
  return (
    <section className="equipment-bar" aria-label="表达装备栏">
      <div className="equipment-bar__title">
        <WandSparkles aria-hidden="true" size={18} />
        <strong>装备技能</strong>
      </div>

      <div className="equipment-slots">
        {equipment.length > 0 ? (
          equipment.map((item) => (
            <button className="equipment-slot" key={item.id} title={item.meaningZh} type="button">
              <span>{item.equipmentName}</span>
              <strong>{item.expression}</strong>
              <small>{item.rarity}</small>
            </button>
          ))
        ) : (
          <span className="equipment-empty">阅读页收藏表达后，这里会变成技能槽。</span>
        )}
      </div>
    </section>
  );
}
