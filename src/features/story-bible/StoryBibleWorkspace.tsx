import { useState } from "react";
import type { StoryBibleDocument } from "../../application/services/story-bible-workflow-service";
import { StoryBibleWorkflowService } from "../../application/services/story-bible-workflow-service";

export function StoryBibleWorkspace({ bible, onChange }: { bible: StoryBibleDocument; onChange: (bible: StoryBibleDocument) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const service = new StoryBibleWorkflowService();
  return <div className="story-bible-workspace" aria-label="故事圣经">
    <div className="section-heading"><strong>故事圣经</strong><span>{bible.lockedFacts.filter((fact) => fact.locked).length} 条已锁定事实</span></div>
    <div className="bible-grid">
      <section><h3>人物卡</h3>{bible.characters.map((character) => <article className="bible-item" key={character.id}><strong>{character.name}</strong><span>{character.identity}</span><small>{character.appearance}</small></article>)}</section>
      <section><h3>时间线</h3><ol>{bible.timeline.map((item) => <li key={item}>{item}</li>)}</ol></section>
    </div>
    <section><h3>锁定事实</h3><div className="fact-list">{bible.lockedFacts.map((fact) => <button type="button" className={selected === fact.id ? "fact selected" : "fact"} key={fact.id} onClick={() => setSelected(fact.id)}><span>{fact.category}</span><strong>{fact.value}</strong><em>{fact.locked ? "已锁定" : "未锁定"}</em></button>)}</div></section>
    {selected && <div className="fact-actions"><button type="button" onClick={() => onChange(factToggle(service, bible, selected))}>{bible.lockedFacts.find((fact) => fact.id === selected)?.locked ? "解锁事实" : "锁定事实"}</button></div>}
  </div>;
}

function factToggle(service: StoryBibleWorkflowService, bible: StoryBibleDocument, id: string) {
  return bible.lockedFacts.find((fact) => fact.id === id)?.locked ? service.unlockFact(bible, id) : service.lockFact(bible, id);
}
