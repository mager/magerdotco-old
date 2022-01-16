import type { MetaFunction, LoaderFunction } from "remix";
import { useLoaderData, json, Link } from "remix";

type IndexData = {
  resources: Array<{ name: string; url: string }>;
  demos: Array<{ name: string; to: string }>;
};

// Loaders provide data to components and are only ever called on the server, so
// you can connect to a database or run any server side code you want right next
// to the component that renders it.
// https://remix.run/api/conventions#loader
export const loader: LoaderFunction = () => {
  const data: IndexData = {
    resources: [
      {
        name: "Remix Docs",
        url: "https://remix.run/docs",
      },
      {
        name: "React Router Docs",
        url: "reactrouter.com/docs",
      },
      {
        name: "Remix Discord",
        url: "https://discord.gg/VBePs6d",
      },
    ],
    demos: [
      {
        to: "demos/actions",
        name: "Actions",
      },
      {
        to: "demos/about",
        name: "Nested Routes, CSS loading/unloading",
      },
      {
        to: "demos/params",
        name: "URL Params and Error Boundaries",
      },
    ],
  };

  // https://remix.run/api/remix#json
  return json(data);
};

// https://remix.run/api/conventions#meta
export const meta: MetaFunction = () => {
  return {
    title: "Remix Starter",
    description: "Welcome to remix!",
  };
};

// https://remix.run/guides/routing#index-routes
export default function Index() {
  const data = useLoaderData<IndexData>();

  return (
    <div className="remix__page">
      <main>
        <h2>Welcome to mager.co</h2>
        <p>I am excited that you're here. 🥳</p>
        <p>
          This site is under construction, so please excuse the mess. Check out
          the Posts section for my blog.
        </p>
      </main>
    </div>
  );
}
