'use client';

import { useState, useEffect } from 'react';

interface LessonStep {
  id: number;
  prompt: string;
  heading: string;
  subtext: string;
}

interface Lesson {
  id: number;
  title: string;
  description: string;
  icon: string;
  steps: LessonStep[];
}

const STORAGE_KEY = 'json-converter-lessons';

export default function JsonConverterPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [editingStep, setEditingStep] = useState<{ lessonIndex: number; stepIndex: number } | null>(null);
  const [editingLesson, setEditingLesson] = useState<number | null>(null);
  const [addingLesson, setAddingLesson] = useState(false);
  const [addingStep, setAddingStep] = useState<number | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Load lessons from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedLessons = localStorage.getItem(STORAGE_KEY);
        if (savedLessons) {
          const parsed = JSON.parse(savedLessons);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLessons(parsed);
          }
        }
      } catch (error) {
        console.error('Error loading lessons from localStorage:', error);
      }
    }
  }, []);

  // Save lessons to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && lessons.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lessons));
      } catch (error) {
        console.error('Error saving lessons to localStorage:', error);
      }
    } else if (typeof window !== 'undefined' && lessons.length === 0) {
      // Clear localStorage if lessons array is empty
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [lessons]);

  const loadExample = () => {
    const example: Lesson[] = [
      {
        id: 1,
        title: 'Use AI to perform Simple Trade',
        description: 'Learn how to execute trades using AI assistance',
        icon: '💰',
        steps: [
          {
            id: 1,
            prompt: 'Give me 5 trading recommendations for today',
            heading: 'Step 1: Get Trading Recommendations',
            subtext: 'Ask the AI for trading recommendations to see what opportunities are available.',
          },
          {
            id: 2,
            prompt: 'Buy {some currency pair}',
            heading: 'Step 2: Execute a Trade',
            subtext: 'After reviewing the recommendations, execute a trade by specifying the currency pair from the recommendations.',
          },
        ],
      },
      {
        id: 2,
        title: 'Use AI to Analyze a Chart',
        description: 'Get detailed technical analysis and insights from charts',
        icon: '📊',
        steps: [
          {
            id: 1,
            prompt: 'Analyze EUR/USD chart',
            heading: 'Step 1: Request Chart Analysis',
            subtext: 'Ask the AI to analyze any currency pair or trading instrument. You can specify timeframes and indicators.',
          },
          {
            id: 2,
            prompt: 'Show me support and resistance levels',
            heading: 'Step 2: Get Technical Levels',
            subtext: 'The AI will identify key support and resistance levels, trend lines, and important price zones on the chart.',
          },
        ],
      },
    ];
    setLessons(example);
  };

  const clearAll = () => {
    if (confirm('Are you sure you want to clear all lessons? This cannot be undone.')) {
      setLessons([]);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  };

  const handleJsonParse = () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonInput);
      let lessonsData: Lesson[] = [];
      if (Array.isArray(parsed)) {
        lessonsData = parsed;
      } else if (parsed.lessons && Array.isArray(parsed.lessons)) {
        lessonsData = parsed.lessons;
      } else {
        throw new Error('JSON must contain a lessons array');
      }
      setLessons(lessonsData);
      setJsonInput('');
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON format');
    }
  };

  const updateStep = (lessonIndex: number, stepIndex: number, field: keyof LessonStep, value: any) => {
    const newLessons = [...lessons];
    newLessons[lessonIndex].steps[stepIndex] = {
      ...newLessons[lessonIndex].steps[stepIndex],
      [field]: value,
    };
    setLessons(newLessons);
  };

  const updateLesson = (lessonIndex: number, field: keyof Lesson, value: any) => {
    const newLessons = [...lessons];
    newLessons[lessonIndex] = {
      ...newLessons[lessonIndex],
      [field]: value,
    };
    setLessons(newLessons);
  };

  const addLesson = (newLesson: Omit<Lesson, 'id'>) => {
    // Auto-generate ID: find max ID and add 1
    const maxId = lessons.length > 0 ? Math.max(...lessons.map(l => l.id)) : 0;
    const lessonWithId: Lesson = {
      ...newLesson,
      id: maxId + 1,
    };
    setLessons([...lessons, lessonWithId]);
    setAddingLesson(false);
  };

  const addStep = (lessonIndex: number, newStep: Omit<LessonStep, 'id'>) => {
    const newLessons = [...lessons];
    // Auto-generate step ID: find max step ID in this lesson and add 1
    const existingSteps = newLessons[lessonIndex].steps;
    const maxStepId = existingSteps.length > 0 ? Math.max(...existingSteps.map(s => s.id)) : 0;
    const stepWithId: LessonStep = {
      ...newStep,
      id: maxStepId + 1,
    };
    newLessons[lessonIndex].steps = [...existingSteps, stepWithId];
    setLessons(newLessons);
    setAddingStep(null);
  };

  const deleteStep = (lessonIndex: number, stepIndex: number) => {
    const newLessons = [...lessons];
    newLessons[lessonIndex].steps = newLessons[lessonIndex].steps.filter((_, i) => i !== stepIndex);
    setLessons(newLessons);
  };

  const deleteLesson = (lessonIndex: number) => {
    setLessons(lessons.filter((_, i) => i !== lessonIndex));
  };

  const generateJson = () => {
    const json = { lessons };
    setJsonInput(JSON.stringify(json, null, 2));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 md:p-8 pt-16 md:pt-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Visual Editor
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Click on any step or lesson to edit • Add new items easily
          </p>

          <div className="flex gap-3 mb-6 flex-wrap">
            <button
              onClick={loadExample}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              📋 Load Example
            </button>
            <button
              onClick={() => setAddingLesson(true)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
            >
              ➕ Add Lesson
            </button>
            <button
              onClick={generateJson}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              📄 Get JSON
            </button>
            {lessons.length > 0 && (
              <button
                onClick={clearAll}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                🗑️ Clear All
              </button>
            )}
          </div>

          {/* JSON Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Paste JSON to load:
            </label>
            <div className="flex gap-2">
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='Paste JSON here, e.g., { "lessons": [...] }'
                className="flex-1 h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
              />
              <button
                onClick={handleJsonParse}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Load
              </button>
            </div>
            {jsonError && (
              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-red-800 dark:text-red-400 text-sm">{jsonError}</p>
              </div>
            )}
          </div>

          {/* Generated JSON Output */}
          {jsonInput && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-blue-900 dark:text-blue-300">Generated JSON:</h3>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(jsonInput);
                    alert('Copied!');
                  }}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                >
                  Copy
                </button>
              </div>
              <pre className="text-xs text-blue-900 dark:text-blue-200 overflow-x-auto">
                {jsonInput}
              </pre>
            </div>
          )}
        </div>

        {/* Add Lesson Form */}
        {addingLesson && (
          <LessonForm
            onSave={addLesson}
            onCancel={() => setAddingLesson(false)}
          />
        )}

        {/* Visualized Lessons */}
        {lessons.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Visualized Structure ({lessons.length} {lessons.length === 1 ? 'Lesson' : 'Lessons'})
            </h2>
            <div className="space-y-6">
              {lessons.map((lesson, lessonIndex) => (
                <div
                  key={lesson.id}
                  className="border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:border-blue-300 dark:hover:border-blue-600 transition-colors duration-200"
                >
                  {/* Lesson Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="text-4xl">{lesson.icon || '📚'}</div>
                    <div className="flex-1">
                      {editingLesson === lessonIndex ? (
                        <LessonForm
                          lesson={lesson}
                          onSave={(updated) => {
                            updateLesson(lessonIndex, 'title', updated.title);
                            updateLesson(lessonIndex, 'description', updated.description);
                            updateLesson(lessonIndex, 'icon', updated.icon);
                            // ID is not editable, keep existing
                            setEditingLesson(null);
                          }}
                          onCancel={() => setEditingLesson(null)}
                        />
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {lesson.title}
                              </h3>
                              <p className="text-gray-600 dark:text-gray-400">
                                {lesson.description}
                              </p>
                              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                <span className="font-medium">Lesson ID:</span> {lesson.id}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingLesson(lessonIndex)}
                                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteLesson(lessonIndex)}
                                className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-sm rounded"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Steps ({lesson.steps?.length || 0})
                      </h4>
                      {addingStep !== lessonIndex && (
                        <button
                          onClick={() => setAddingStep(lessonIndex)}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded"
                        >
                          ➕ Add Step
                        </button>
                      )}
                    </div>
                    
                    {/* Existing Steps */}
                    {lesson.steps && lesson.steps.length > 0 && (
                      <div className="space-y-4 mb-4">
                        {lesson.steps.map((step, stepIndex) => (
                          <div key={step.id || stepIndex}>
                            {editingStep?.lessonIndex === lessonIndex && editingStep?.stepIndex === stepIndex ? (
                              <StepForm
                                step={step}
                                onSave={(updated) => {
                                  // ID is not editable, keep existing
                                  updateStep(lessonIndex, stepIndex, 'prompt', updated.prompt);
                                  updateStep(lessonIndex, stepIndex, 'heading', updated.heading);
                                  updateStep(lessonIndex, stepIndex, 'subtext', updated.subtext);
                                  setEditingStep(null);
                                }}
                                onCancel={() => setEditingStep(null)}
                                onDelete={() => {
                                  deleteStep(lessonIndex, stepIndex);
                                  setEditingStep(null);
                                }}
                              />
                            ) : (
                              <div
                                onClick={() => setEditingStep({ lessonIndex, stepIndex })}
                                className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-5 border-l-4 border-blue-500 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                    {step.id || stepIndex + 1}
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-semibold text-gray-900 dark:text-white mb-2">
                                      {step.heading || `Step ${step.id || stepIndex + 1}`}
                                    </h5>
                                    {step.subtext && (
                                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                                        {step.subtext}
                                      </p>
                                    )}
                                    {step.prompt && (
                                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                                          Example Prompt:
                                        </p>
                                        <p className="text-sm font-mono text-blue-900 dark:text-blue-200">
                                          {step.prompt}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Step Form - Show when adding or when no steps exist */}
                    {addingStep === lessonIndex && (
                      <div className="mt-4">
                        <StepForm
                          onSave={(newStep) => {
                            addStep(lessonIndex, newStep);
                          }}
                          onCancel={() => setAddingStep(null)}
                        />
                      </div>
                    )}

                    {/* Show message if no steps yet */}
                    {(!lesson.steps || lesson.steps.length === 0) && addingStep !== lessonIndex && (
                      <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                        No steps yet. Click "Add Step" to get started.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LessonForm({ lesson, onSave, onCancel }: { lesson?: Lesson; onSave: (lesson: Omit<Lesson, 'id'>) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState<Omit<Lesson, 'id'>>(lesson ? {
    title: lesson.title,
    description: lesson.description,
    icon: lesson.icon,
    steps: lesson.steps,
  } : {
    title: '',
    description: '',
    icon: '📚',
    steps: [],
  });

  return (
    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-5 border-2 border-blue-400">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        {lesson ? `Edit Lesson (ID: ${lesson.id})` : 'Add New Lesson'}
      </h3>
      {lesson && (
        <div className="mb-3 p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-sm text-blue-800 dark:text-blue-300">
          Lesson ID: {lesson.id} (Auto-generated, cannot be changed)
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            placeholder="Enter lesson title"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            rows={2}
            placeholder="Enter lesson description"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Icon (emoji)
          </label>
          <input
            type="text"
            value={formData.icon}
            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            placeholder="💰"
            maxLength={2}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function StepForm({ step, onSave, onCancel, onDelete }: { step?: LessonStep; onSave: (step: Omit<LessonStep, 'id'>) => void; onCancel: () => void; onDelete?: () => void }) {
  const [formData, setFormData] = useState<Omit<LessonStep, 'id'>>(step ? {
    prompt: step.prompt,
    heading: step.heading,
    subtext: step.subtext,
  } : {
    prompt: '',
    heading: '',
    subtext: '',
  });

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-5 border-2 border-blue-400">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        {step ? `Edit Step (ID: ${step.id})` : 'Add New Step'}
      </h3>
      {step && (
        <div className="mb-3 p-2 bg-blue-100 dark:bg-blue-900/30 rounded text-sm text-blue-800 dark:text-blue-300">
          Step ID: {step.id} (Auto-generated, cannot be changed)
        </div>
      )}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Heading
          </label>
          <input
            type="text"
            value={formData.heading}
            onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            placeholder="Step 1: Get Trading Recommendations"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Subtext
          </label>
          <textarea
            value={formData.subtext}
            onChange={(e) => setFormData({ ...formData, subtext: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            rows={2}
            placeholder="Ask the AI for trading recommendations..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Example Prompt
          </label>
          <input
            type="text"
            value={formData.prompt}
            onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
            placeholder="Give me 5 trading recommendations for today"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSave(formData)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg"
          >
            Cancel
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
