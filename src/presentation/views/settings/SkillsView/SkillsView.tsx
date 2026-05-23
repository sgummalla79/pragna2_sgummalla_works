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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/presentation/components/ui/Select';

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
                <Select
                  value={skillType}
                  onValueChange={(v) => setSkillType(v as SkillType)}
                >
                  <SelectTrigger id="skill-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKILL_TYPE_FUNCTION}>{SKILL_TYPE_LABELS[SKILL_TYPE_FUNCTION]}</SelectItem>
                    <SelectItem value={SKILL_TYPE_AGENT}>{SKILL_TYPE_LABELS[SKILL_TYPE_AGENT]}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="skill-description">Description (shown to LLM)</Label>
                <Input id="skill-description" placeholder="Summarizes text when the user asks to summarize something." value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {models.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="skill-model">Model (optional)</Label>
                  <Select
                    value={userModelId || '__none__'}
                    onValueChange={(v) => setUserModelId(v === '__none__' ? '' : v)}
                  >
                    <SelectTrigger id="skill-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                // Required-field gate. Mirrors the inline validation in
                // ``handleCreate`` ("Name and description are required.")
                // so the user can't even click while a required field
                // is missing. Whitespace-only counts as missing.
                disabled={
                  createSkill.isPending ||
                  !name.trim() ||
                  !description.trim()
                }
              >
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
          {/* svgrepo "skill" — hand holding a gear. Same artwork as the
              Settings sidebar nav icon so the empty state visually
              connects the section header to the missing rows. */}
          <svg
            width="48"
            height="48"
            viewBox="0 0 100 100"
            fill="currentColor"
            aria-hidden="true"
            className="mx-auto mb-3 opacity-30"
          >
            <path fillRule="evenodd" d="M43.84,46.76a5.35,5.35,0,1,1,5.46-5.34A5.41,5.41,0,0,1,43.84,46.76Z" />
            <path fillRule="evenodd" d="M77.33,55.7,70.06,44.9V44A24,24,0,0,0,46.19,20a22,22,0,0,0-5.67.7A23.89,23.89,0,0,0,22.31,44a21.92,21.92,0,0,0,3.58,12.7c4.18,6,7,10.8,5.27,17.3a4.58,4.58,0,0,0,.9,4.2A4.43,4.43,0,0,0,35.74,80h19.6A4.72,4.72,0,0,0,60,76.2a5,5,0,0,0,.2-1.2,2.37,2.37,0,0,1,2.39-2H64a4.72,4.72,0,0,0,4.68-3.4A41.31,41.31,0,0,0,70.16,60h5.17a2.78,2.78,0,0,0,2.19-1.6A2.86,2.86,0,0,0,77.33,55.7ZM57.49,47.33l-1,1.57a2.22,2.22,0,0,1-1.76.94,2.38,2.38,0,0,1-.72-.16l-2.65-1a11.64,11.64,0,0,1-3.85,2.2l-.48,2.91a2,2,0,0,1-2,1.65h-2a2,2,0,0,1-2-1.65l-.48-2.91a10,10,0,0,1-3.69-2l-2.81,1a2.38,2.38,0,0,1-.72.16,2.1,2.1,0,0,1-1.76-1l-1-1.65a1.94,1.94,0,0,1,.48-2.51l2.33-1.89a10.11,10.11,0,0,1-.24-2.12,9.41,9.41,0,0,1,.24-2L31.1,36.88a1.92,1.92,0,0,1-.48-2.51l1-1.65a2,2,0,0,1,1.76-1,2.38,2.38,0,0,1,.72.16l2.81,1a11.52,11.52,0,0,1,3.69-2.12L41,28a1.91,1.91,0,0,1,2-1.57h2a1.92,1.92,0,0,1,2,1.49l.48,2.83a11.31,11.31,0,0,1,3.69,2l2.81-1a2.38,2.38,0,0,1,.72-.16,2.1,2.1,0,0,1,1.76,1l1,1.65A2,2,0,0,1,57,36.8l-2.33,1.89a9.56,9.56,0,0,1,.24,2.12,9.41,9.41,0,0,1-.24,2L57,44.74A2,2,0,0,1,57.49,47.33Z" />
          </svg>
          <p>No skills yet. Create one to enable /slash-commands in chat.</p>
        </div>
      ) : (
        <ul className="space-y-3 list-none" role="list">
          {skills.map((s) => (
            <li key={s.id}>
              <Card>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Zap
                      size={22}
                      className="shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium font-mono text-primary">/{s.name}</p>
                        <Badge variant="secondary">{SKILL_TYPE_LABELS[s.skillType] ?? s.skillType}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
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
