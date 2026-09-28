// import {
//   Facebook,
//   FileImage,
//   Instagram,
//   Linkedin,
//   Twitter,
//   Youtube,
// } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3">
              {/* <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-white">
                <FileImage size={21} />
              </div> */}

              <span className="text-2xl font-extrabold text-slate-900">
                Doc<span className="text-indigo-600">Tools</span>
              </span>
            </div>

            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-600">
              A simple and powerful platform to edit, convert, compress and
              manage your PDF and image files. Fast, secure and free.
            </p>

            {/* <div className="mt-5 flex gap-3">
              {[Facebook, Twitter, Instagram, Youtube, Linkedin].map(
                (Icon, index) => (
                  <a
                    key={index}
                    href="/"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm hover:bg-indigo-600 hover:text-white"
                  >
                    <Icon size={17} />
                  </a>
                ),
              )}
            </div> */}
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900">
              Quick Links
            </h3>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <a href="/" className="block hover:text-indigo-600">
                Home
              </a>

              <a href="/#tools" className="block hover:text-indigo-600">
                All Tools
              </a>

              <a href="/#pdf-tools" className="block hover:text-indigo-600">
                PDF Tools
              </a>

              <a href="/#image-tools" className="block hover:text-indigo-600">
                Image Tools
              </a>

              <a href="/" className="block hover:text-indigo-600">
                Blog
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900">
              Popular Tools
            </h3>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <a href="/tool/compress-pdf/upload" className="block hover:text-indigo-600">
                Compress PDF
              </a>

              <a href="/tool/pdf-to-jpg/upload" className="block hover:text-indigo-600">
                PDF to JPG
              </a>

              <a href="/tool/jpg-to-pdf/upload" className="block hover:text-indigo-600">
                JPG to PDF
              </a>

              <a href="/tool/merge-pdf/upload" className="block hover:text-indigo-600">
                Merge PDF
              </a>

              <a href="/tool/crop-image/upload" className="block hover:text-indigo-600">
                Crop Image
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900">
              Support
            </h3>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <a href="/" className="block hover:text-indigo-600">
                Help Center
              </a>

              <a href="/" className="block hover:text-indigo-600">
                Contact Us
              </a>

              <a href="/" className="block hover:text-indigo-600">
                Privacy Policy
              </a>

              <a href="/" className="block hover:text-indigo-600">
                Terms of Service
              </a>

              <a href="/" className="block hover:text-indigo-600">
                DMCA
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-sm text-slate-500">
          © 2025 DocTools. All rights reserved.
        </div>
      </div>
    </footer>
  );
}