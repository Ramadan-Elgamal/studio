
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, AlertTriangle, BookText, Rocket, FileText, Link as LinkIcon, Pencil, X, Check as CheckIcon, Share2, Copy } from 'lucide-react';
import type { GenerateCourseOutput, Lesson, MicroLesson } from '@/ai/flows/generate-course';
import { useToast } from '@/hooks/use-toast';

// Add a 'completed' property to lessons and micro-lessons for state tracking
interface CourseLesson extends Lesson {
  completed?: boolean;
  microLessons?: CourseMicroLesson[];
}
interface CourseMicroLesson extends MicroLesson {
  completed?: boolean;
}
interface CourseWithProgress extends GenerateCourseOutput {
  lessons: CourseLesson[];
}


export default function CourseDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const { courseId } = params;
  const [course, setCourse] = useState<CourseWithProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<{ title: string; description: string }>({ title: '', description: '' });
  
  const [shareLink, setShareLink] = useState('');

  const generateShareLink = () => {
    if (!course) return;
    try {
      const courseString = JSON.stringify(course);
      const encodedCourse = btoa(encodeURIComponent(courseString));
      const link = `${window.location.origin}/share/${encodedCourse}`;
      setShareLink(link);
    } catch (e) {
      console.error("Failed to generate share link", e);
      toast({
        title: "Error",
        description: "Could not generate a shareable link for this course.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink).then(() => {
      toast({
        title: "Copied!",
        description: "The shareable link has been copied to your clipboard.",
      });
    }).catch(err => {
        console.error("Failed to copy", err);
        toast({
            title: "Error",
            description: "Could not copy the link.",
            variant: "destructive",
        })
    });
  };


  useEffect(() => {
    if (typeof courseId !== 'string') return;

    try {
      const item = window.localStorage.getItem('savedCourses');
      if (item) {
        const savedCourses: CourseWithProgress[] = JSON.parse(item);
        const courseIndex = parseInt(courseId, 10);
        if (savedCourses[courseIndex]) {
          // Ensure completion status exists
          const courseData = savedCourses[courseIndex];
          courseData.lessons = courseData.lessons.map(lesson => ({
            ...lesson,
            completed: !!lesson.completed,
            microLessons: lesson.microLessons?.map(ml => ({...ml, completed: !!ml.completed}))
          }));
          setCourse(courseData);
        } else {
          setError('Course not found.');
        }
      } else {
        setError('No saved courses found.');
      }
    } catch (e) {
      console.error("Failed to parse saved courses from localStorage", e);
      setError('Failed to load course data.');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  const updateCourseProgress = (updatedCourse: CourseWithProgress) => {
    setCourse(updatedCourse);
     if (typeof courseId !== 'string') return;
     try {
       const item = window.localStorage.getItem('savedCourses');
       if (item) {
         const savedCourses = JSON.parse(item);
         const courseIndex = parseInt(courseId, 10);
         savedCourses[courseIndex] = updatedCourse;
         window.localStorage.setItem('savedCourses', JSON.stringify(savedCourses));
       }
     } catch(e) {
        console.error("Failed to update course in localStorage", e);
     }
  };
  
  const handleToggleMicroLesson = (lessonIndex: number, microLessonIndex: number) => {
    if (!course) return;
    const newCourse = { ...course };
    const microLesson = newCourse.lessons[lessonIndex]?.microLessons?.[microLessonIndex];
    if (microLesson) {
      microLesson.completed = !microLesson.completed;
      updateCourseProgress(newCourse);
    }
  };
  
  const handleToggleLesson = (lessonIndex: number) => {
     if (!course) return;
     const newCourse = { ...course };
     const lesson = newCourse.lessons[lessonIndex];
     if(lesson) {
        lesson.completed = !lesson.completed;
        // Also mark all its micro-lessons
        if(lesson.microLessons) {
            lesson.microLessons.forEach(ml => ml.completed = lesson.completed);
        }
        updateCourseProgress(newCourse);
     }
  };

  const handleStartEditing = (id: string, currentTitle: string, currentDescription: string) => {
    setEditingId(id);
    setEditedContent({ title: currentTitle, description: currentDescription });
  };

  const handleCancelEditing = () => {
    setEditingId(null);
    setEditedContent({ title: '', description: '' });
  };

  const handleSaveEditing = () => {
    if (!editingId || !course) return;
    const [type, lessonIndexStr, microLessonIndexStr] = editingId.split('-');
    const lessonIndex = parseInt(lessonIndexStr, 10);

    const newCourse = { ...course };

    if (type === 'lesson' && newCourse.lessons[lessonIndex]) {
      newCourse.lessons[lessonIndex].title = editedContent.title;
      newCourse.lessons[lessonIndex].description = editedContent.description;
    } else if (type === 'microlesson') {
      const microLessonIndex = parseInt(microLessonIndexStr, 10);
      const microLesson = newCourse.lessons[lessonIndex]?.microLessons?.[microLessonIndex];
      if (microLesson) {
        microLesson.title = editedContent.title;
        microLesson.description = editedContent.description;
      }
    }
    
    updateCourseProgress(newCourse);
    handleCancelEditing();
  };

  const { progress, totalItems } = useMemo(() => {
    if (!course) return { progress: 0, totalItems: 0 };
    let completedCount = 0;
    let totalCount = 0;
    course.lessons.forEach(lesson => {
      if (lesson.microLessons && lesson.microLessons.length > 0) {
        lesson.microLessons.forEach(ml => {
          totalCount++;
          if (ml.completed) completedCount++;
        });
      } else {
        totalCount++;
        if (lesson.completed) completedCount++;
      }
    });
    return {
      progress: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
      totalItems: totalCount,
    };
  }, [course]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !course) {
    return (
        <Card className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-8 border-dashed">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h3 className="mt-4 text-xl font-semibold font-headline">Error Loading Course</h3>
            <p className="mt-2 text-sm text-muted-foreground">
                {error || 'The course you are looking for could not be displayed.'}
            </p>
            <Button asChild className="mt-4" variant="outline">
                <Link href="/dashboard/courses">
                    <ArrowLeft className="mr-2" /> Back to My Courses
                </Link>
            </Button>
        </Card>
    );
  }

  const curriculumTitle = course.isProjectBased ? 'Projects' : 'Curriculum';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/courses">
                <ArrowLeft className="mr-2" /> Back to My Courses
            </Link>
        </Button>
         <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={generateShareLink}>
                    <Share2 className="mr-2" /> Share
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Share this Course</DialogTitle>
                    <DialogDescription>
                        Anyone with this link will be able to view a read-only version of this course.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex items-center space-x-2">
                    <Input value={shareLink} readOnly />
                    <Button onClick={copyToClipboard} size="sm" className="px-3">
                        <span className="sr-only">Copy</span>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>
        
      <Card>
        <CardHeader>
          <CardTitle className="font-headline text-3xl">{course.title}</CardTitle>
          <CardDescription className="text-base">{course.summary}</CardDescription>
           {totalItems > 0 && (
              <div className="pt-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="progress">Your Progress</Label>
                    <span className="text-sm font-medium text-muted-foreground">{Math.round(progress)}% Complete</span>
                  </div>
                  <Progress id="progress" value={progress} className="h-2" />
              </div>
            )}
        </CardHeader>
        <CardContent>
          <h4 className="font-semibold mb-4 text-xl font-headline">{curriculumTitle}</h4>
            <Accordion type="multiple" className="w-full space-y-4">
            {course.lessons.map((lesson, lessonIndex) => {
              const lessonEditingId = `lesson-${lessonIndex}`;
              const isEditingLesson = editingId === lessonEditingId;

              return(
              <AccordionItem key={lessonIndex} value={`lesson-${lessonIndex}`} className="border rounded-lg px-4">
                <AccordionTrigger className="text-lg font-semibold hover:no-underline gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    {course.isProjectBased ? <Rocket className="size-5 text-primary"/> : <FileText className="size-5 text-primary"/>}
                     {isEditingLesson ? (
                        <Input 
                            value={editedContent.title}
                            onChange={(e) => setEditedContent({...editedContent, title: e.target.value})}
                            className="text-lg font-semibold"
                            onClick={(e) => e.stopPropagation()}
                        />
                     ) : (
                        `${lessonIndex + 1}. ${lesson.title}`
                     )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <div className="space-y-4 pl-8 border-l-2 border-primary/20">
                     {Array.isArray(lesson.microLessons) && lesson.microLessons.length > 0 ? lesson.microLessons.map((microLesson, microIndex) => {
                       const microLessonEditingId = `microlesson-${lessonIndex}-${microIndex}`;
                       const isEditingMicroLesson = editingId === microLessonEditingId;

                       return (
                        <div key={microIndex} className="flex items-start gap-3">
                          <Checkbox 
                            id={`ml-${lessonIndex}-${microIndex}`} 
                            checked={!!microLesson.completed}
                            onCheckedChange={() => handleToggleMicroLesson(lessonIndex, microIndex)}
                            className="mt-1"
                          />
                           <div className="grid gap-1.5 leading-snug flex-1">
                             <label htmlFor={`ml-${lessonIndex}-${microIndex}`} className="font-semibold flex items-center gap-2 cursor-pointer">
                               {isEditingMicroLesson ? (
                                    <Input 
                                        value={editedContent.title}
                                        onChange={(e) => setEditedContent({...editedContent, title: e.target.value})}
                                        className="font-semibold"
                                    />
                               ) : (
                                 `${lessonIndex + 1}.${microIndex + 1} ${microLesson.title}`
                               )}
                             </label>
                             {isEditingMicroLesson ? (
                                <Textarea 
                                    value={editedContent.description}
                                    onChange={(e) => setEditedContent({...editedContent, description: e.target.value})}
                                    className="text-base leading-relaxed"
                                    rows={4}
                                />
                             ) : (
                                <p className="text-muted-foreground whitespace-pre-wrap text-base leading-relaxed">{microLesson.description}</p>
                             )}

                            {isEditingMicroLesson ? (
                                <div className="flex items-center gap-2 mt-2">
                                    <Button size="sm" onClick={handleSaveEditing}><CheckIcon className="size-4 mr-2" />Save</Button>
                                    <Button size="sm" variant="ghost" onClick={handleCancelEditing}><X className="size-4 mr-2" />Cancel</Button>
                                </div>
                            ) : (
                                <Button size="sm" variant="ghost" className="justify-start p-1 h-auto -ml-1 text-muted-foreground" onClick={() => handleStartEditing(microLessonEditingId, microLesson.title, microLesson.description)}>
                                    <Pencil className="size-3 mr-2" /> Edit
                                </Button>
                            )}

                            {!isEditingMicroLesson && microLesson.resources && (microLesson.resources.free?.length || microLesson.resources.paid?.length) && (
                                <div className="mt-3 rounded-md border bg-secondary/50 p-3 text-sm">
                                    <h6 className="font-semibold mb-2">Resources</h6>
                                    {microLesson.resources.free && microLesson.resources.free.length > 0 && (
                                        <div className="mb-2">
                                            <p className="font-medium text-secondary-foreground mb-1">Free</p>
                                            <ul className="list-none space-y-1">
                                                {microLesson.resources.free.map((link, linkIndex) => (
                                                    <li key={linkIndex}>
                                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                                                            <LinkIcon className="size-3" /> {link.title} <span className="text-xs text-muted-foreground">({link.platform})</span>
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                     {microLesson.resources.paid && microLesson.resources.paid.length > 0 && (
                                        <div>
                                            <p className="font-medium text-secondary-foreground mb-1">Paid</p>
                                            <ul className="list-none space-y-1">
                                                {microLesson.resources.paid.map((link, linkIndex) => (
                                                    <li key={linkIndex}>
                                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline">
                                                           <LinkIcon className="size-3" /> {link.title} <span className="text-xs text-muted-foreground">({link.platform})</span>
                                                        </a>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                           </div>
                        </div>
                       )
                     }) : (
                        <div className="flex items-start gap-3">
                            <Checkbox 
                                id={`l-${lessonIndex}`} 
                                checked={!!lesson.completed}
                                onCheckedChange={() => handleToggleLesson(lessonIndex)}
                                className="mt-1"
                             />
                             <div className="grid gap-1.5 leading-snug flex-1">
                                <label htmlFor={`l-${lessonIndex}`} className="font-semibold flex items-center gap-2 cursor-pointer">
                                    Mark as complete
                                </label>
                                 {isEditingLesson ? (
                                    <Textarea 
                                        value={editedContent.description}
                                        onChange={(e) => setEditedContent({...editedContent, description: e.target.value})}
                                        className="text-base leading-relaxed"
                                        rows={4}
                                    />
                                 ) : (
                                    <p className="text-muted-foreground whitespace-pre-wrap text-base leading-relaxed">{lesson.description}</p>
                                 )}

                                 {isEditingLesson ? (
                                    <div className="flex items-center gap-2 mt-2">
                                        <Button size="sm" onClick={handleSaveEditing}><CheckIcon className="size-4 mr-2" />Save</Button>
                                        <Button size="sm" variant="ghost" onClick={handleCancelEditing}><X className="size-4 mr-2" />Cancel</Button>
                                    </div>
                                ) : (
                                     <Button size="sm" variant="ghost" className="justify-start p-1 h-auto -ml-1 text-muted-foreground" onClick={() => handleStartEditing(lessonEditingId, lesson.title, lesson.description)}>
                                        <Pencil className="size-3 mr-2" /> Edit
                                    </Button>
                                )}
                             </div>
                        </div>
                     )}
                  </div>
                </AccordionContent>
              </AccordionItem>
              )
            })}
          </Accordion>

          <div className="mt-8 border-t pt-6">
              <h4 className="font-headline text-xl flex items-center gap-2"><BookText className="size-5 text-primary" />Final Note</h4>
              <p className="text-muted-foreground mt-2 text-base leading-relaxed">{course.finalNote}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
