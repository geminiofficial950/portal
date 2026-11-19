// Filled icons for the student navigation. Cutouts use the chip's background.
const paths = {
  Dashboard: "M5 3h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm10 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM5 13h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Zm10 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z",
  Courses: "M12 2 21.5 7v10L12 22l-9.5-5V7L12 2ZM5 8.2l6.25 3.35v7.6h1.5v-7.6L19 8.2l-.7-1.3L12 10.25 5.7 6.9 5 8.2Z",
  Classes: "M5 5h9a3 3 0 0 1 3 3v1l4-3a.75.75 0 0 1 1.2.6v10.8a.75.75 0 0 1-1.2.6l-4-3v1a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3Z",
  Requests: "M6 4h2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 0v2h4V4h-4Zm-2 6v1.5h8V10H8Zm0 4v1.5h6V14H8Z",
  Feedback: "M12 3a9 9 0 0 0-8.1 12.9L2.5 21l5.3-1.5A9 9 0 1 0 12 3ZM7 11h2v2H7v-2Zm4 0h2v2h-2v-2Zm4 0h2v2h-2v-2Z",
  Support: "M4 6h16a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8a2 2 0 0 1 2-2Zm10 2v2h1.5V8H14Zm0 3v2h1.5v-2H14Zm0 3v2h1.5v-2H14Z",
  Guide: "M7 2h12a1 1 0 0 1 1 1v13H7a2 2 0 0 0 0 4h13v2H7a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4Zm1 4v1.5h8V6H8Zm0 4v1.5h6V10H8Z",
};

export function StudentNavIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="block size-[17px] lg:size-[15px]">
      <path fillRule="evenodd" d={paths[name]} />
    </svg>
  );
}
