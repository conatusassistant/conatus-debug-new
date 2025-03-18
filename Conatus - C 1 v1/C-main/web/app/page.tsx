import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex justify-between items-center py-6 px-4 md:px-6 border-b">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Conatus</h1>
        </div>
        <nav className="flex gap-4 sm:gap-6">
          <Link 
            href="/login" 
            className="text-sm font-medium hover:underline underline-offset-4"
          >
            Log In
          </Link>
          <Link 
            href="/signup" 
            className="text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 py-2 px-4 rounded-md"
          >
            Sign Up
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl">
                Your AI Assistant for Everything
              </h1>
              <p className="max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                Conatus connects multiple AI models and automates tasks across your favorite services.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  href="/signup" 
                  className="btn-primary"
                >
                  Get Started
                </Link>
                <Link 
                  href="#features" 
                  className="btn-outline"
                >
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="w-full py-12 md:py-24 bg-muted/50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Features
              </h2>
              <p className="max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
                Discover what makes Conatus different from other AI assistants.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-4 bg-primary/10 rounded-full">
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 2v1" />
                    <path d="M12 21v1" />
                    <path d="m4.93 4.93.7.7" />
                    <path d="m18.37 18.37.7.7" />
                    <path d="M2 12h1" />
                    <path d="M21 12h1" />
                    <path d="m4.93 19.07.7-.7" />
                    <path d="m18.37 5.63.7-.7" />
                    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Multiple AI Models</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Connect to Claude, OpenAI, Perplexity, and DeepSeek for specialized tasks.
                </p>
              </div>
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-4 bg-primary/10 rounded-full">
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Powerful Automation</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Create workflows that connect your favorite apps and services.
                </p>
              </div>
              <div className="flex flex-col items-center text-center gap-2">
                <div className="p-4 bg-primary/10 rounded-full">
                  <svg
                    className="h-6 w-6 text-primary"
                    fill="none"
                    height="24"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M17 6.1H3" />
                    <path d="M21 12.1H3" />
                    <path d="M15.1 18H3" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold">Community Templates</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Discover and share automation templates with the community.
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                    Simple Three-Tab Interface
                  </h2>
                  <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
                    Conatus features an intuitive three-tab interface designed for productivity.
                  </p>
                </div>
                <ul className="grid gap-6">
                  <li className="flex gap-4 items-start">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <span>1</span>
                    </div>
                    <div>
                      <h3 className="font-bold">Home Tab</h3>
                      <p className="text-gray-500 dark:text-gray-400">Chat with AI and get instant answers or create automations on the fly.</p>
                    </div>
                  </li>
                  <li className="flex gap-4 items-start">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <span>2</span>
                    </div>
                    <div>
                      <h3 className="font-bold">Library Tab</h3>
                      <p className="text-gray-500 dark:text-gray-400">Create and manage your custom workflows and automations.</p>
                    </div>
                  </li>
                  <li className="flex gap-4 items-start">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <span>3</span>
                    </div>
                    <div>
                      <h3 className="font-bold">Social Tab</h3>
                      <p className="text-gray-500 dark:text-gray-400">Discover popular templates and share your own with the community.</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="mx-auto overflow-hidden rounded-xl border bg-background md:w-full">
                <div className="bg-muted border-b px-4 py-2 flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                  <div className="h-3 w-3 rounded-full bg-green-500"></div>
                </div>
                <div className="aspect-[16/9] overflow-hidden">
                  <div className="grid grid-cols-3 border-b">
                    <div className="flex items-center justify-center border-r p-2 font-medium">Home</div>
                    <div className="flex items-center justify-center border-r p-2 text-muted-foreground">Library</div>
                    <div className="flex items-center justify-center p-2 text-muted-foreground">Social</div>
                  </div>
                  <div className="p-4">
                    <div className="mb-4 flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-4/5 rounded bg-muted"></div>
                        <div className="h-4 w-3/5 rounded bg-muted"></div>
                      </div>
                    </div>
                    <div className="mb-4 ml-10 flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-secondary/10"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-4/5 rounded bg-muted"></div>
                        <div className="h-4 w-3/5 rounded bg-muted"></div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-4/5 rounded bg-muted"></div>
                        <div className="h-4 w-3/5 rounded bg-muted"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 bg-muted/50">
          <div className="container px-4 md:px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Ready to Try Conatus?
            </h2>
            <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400 mt-4">
              Get started today and experience the power of AI automation.
            </p>
            <Link 
              href="/signup" 
              className="btn-primary mt-8 inline-block"
            >
              Sign Up for Free
            </Link>
          </div>
        </section>
      </main>
      <footer className="w-full border-t py-6">
        <div className="container flex flex-col items-center justify-center gap-4 px-4 md:px-6 md:flex-row">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} Conatus. All rights reserved.
          </p>
          <nav className="flex gap-4 sm:gap-6">
            <Link className="text-sm font-medium hover:underline underline-offset-4" href="#">
              Terms
            </Link>
            <Link className="text-sm font-medium hover:underline underline-offset-4" href="#">
              Privacy
            </Link>
            <Link className="text-sm font-medium hover:underline underline-offset-4" href="#">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
