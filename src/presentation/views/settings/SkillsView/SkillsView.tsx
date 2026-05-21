import { useState } from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import { useSkills, useCreateSkill, useDeleteSkill } from '@/presentation/hooks/skills/useSkills';
import { useModels } from '@/presentation/hooks/models/useModels';
import { SKILL_TYPE_FUNCTION, SKILL_TYPE_AGENT, SKILL_TYPE_LABELS } from '@/constants/skillTypes';
import type { SkillType } from '@/domain/types/skill.types';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Label } from '@/presentation/components/ui/Label';
import { Badge } from '@/presentation/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/presentation/components/ui/Card';

export default function SkillsView() {
  const { data: skills = [], isLoading } = useSkills();
  const { data: models = [] } = useModels();
  const createSkill = useCreateSkill();
  const deleteSkill = useDeleteSkill();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [skillType, setSkillType] = useState<SkillType>(SKILL_TYPE_FUNCTION);
  const [userModelId, setUserModelId] = useState('');
  const [formError, setFormError] = useState('');

  async function handleCreate() {
    setFormError('');
    if (!name || !description) { setFormError('Name and description are required.'); return; }
    try {
      await createSkill.mutateAsync({ name, description, skillType, userModelId: userModelId || undefined });
      setShowForm(false);
      setName(''); setDescription(''); setUserModelId('');
    } catch {
      setFormError('Failed to create skill.');
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Skills</h1>
          <p className="text-muted-foreground text-sm mt-1">On-demand capabilities invoked via /slash-command in chat.</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus size={16} aria-hidden="true" />
          New skill
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Create skill</CardTitle>
            <CardDescription>Skills are triggered by /name in the chat interface.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="skill-name">Slash command name</Label>
                <Input id="skill-name" placeholder="summarize" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-type">Type</Label>
                <select
                  id="skill-type"
                  value={skillType}
                  onChange={(e) => setSkillType(e.target.value as SkillType)}
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value={SKILL_TYPE_FUNCTION}>{SKILL_TYPE_LABELS[SKILL_TYPE_FUNCTION]}</option>
                  <option value={SKILL_TYPE_AGENT}>{SKILL_TYPE_LABELS[SKILL_TYPE_AGENT]}</option>
                </select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="skill-description">Description (shown to LLM)</Label>
                <Input id="skill-description" placeholder="Summarizes text when the user asks to summarize something." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {models.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="skill-model">Model (optional)</Label>
                  <select
                    id="skill-model"
                    value={userModelId}
                    onChange={(e) => setUserModelId(e.target.value)}
                    className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">None</option>
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.displayName}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button onClick={handleCreate} disabled={createSkill.isPending}>
                {createSkill.isPending ? 'Saving…' : 'Create skill'}
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading skills…</p>
      ) : skills.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Zap size={40} className="mx-auto mb-3 opacity-30" aria-hidden="true" />
          <p>No skills yet. Create one to enable /slash-commands in chat.</p>
        </div>
      ) : (
        <ul className="space-y-3 list-none" role="list">
          {skills.map((s) => (
            <li key={s.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium font-mono text-primary">/{s.name}</p>
                      <Badge variant="secondary">{SKILL_TYPE_LABELS[s.skillType] ?? s.skillType}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteSkill.mutate(s.id)} aria-label={`Delete skill ${s.name}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
