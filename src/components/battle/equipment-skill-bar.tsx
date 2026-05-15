import { Sparkles, WandSparkles } from "lucide-react";

import type { BattleEquipmentView } from "@/server/battles/battle-model";

type EquipmentSkillBarProps = {
  equipment: BattleEquipmentView[];
};

const ACTIVE_SKILLS = [
  { id: "encourage", label: "Encourage", hint: "插入鼓励语，下一回合无 graze 减伤" },
  { id: "polite-tip", label: "Polite Tip", hint: "引用礼貌框架，命中提升一级" }
];

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
            <button
              className={`equipment-slot equipment-slot--${item.rarity}`}
              key={item.id}
              title={item.meaningZh}
              type="button"
            >
              <span className="equipment-slot__head">
                {item.equipmentName}
                <em>Lv. {Math.max(1, Math.min(5, item.useCount + 1))}</em>
              </span>
              <strong>{item.expression}</strong>
              <small>{item.rarity}</small>
            </button>
          ))
        ) : (
          <span className="equipment-empty">阅读页收藏表达后，这里会变成技能槽。</span>
        )}
      </div>

      <div className="active-skill-row" aria-label="主动技能（教学占位）">
        {ACTIVE_SKILLS.map((skill) => (
          <button
            className="active-skill"
            key={skill.id}
            type="button"
            title={skill.hint}
            disabled
          >
            <Sparkles aria-hidden="true" size={14} />
            {skill.label}
          </button>
        ))}
      </div>
    </section>
  );
}
