import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { formatSeedFailure, withSeedOperation } from "./seed-errors.mjs";

const prisma = new PrismaClient();

const categories = [
  {
    name: "Web & Technology",
    slug: "web-technology",
    description: "Websites, software, apps and technology support.",
    icon: "monitor",
    services: [
      "Website Development",
      "Web Design",
      "App Development",
      "Software Development",
      "WordPress Development",
      "UI/UX Design",
      "Website Bug Fixing",
      "Website Testing",
      "Website Security",
      "Database Management",
    ],
  },
  {
    name: "AI & Digital",
    slug: "ai-digital",
    description: "Practical AI, marketing and digital growth services.",
    icon: "sparkles",
    services: [
      "AI Automation",
      "AI Content Creation",
      "SEO",
      "Digital Marketing",
      "Social Media Management",
      "Email Marketing",
      "E-commerce Store Setup",
    ],
  },
  {
    name: "Creative",
    slug: "creative",
    description: "Visual design, editing and creative digital content.",
    icon: "pen-tool",
    services: [
      "Graphic Design",
      "Logo Design",
      "Photo Editing",
      "Video Editing",
      "Reels Editing",
      "Animation",
      "YouTube Thumbnail Design",
      "Social Media Design",
    ],
  },
  {
    name: "Data & Office",
    slug: "data-office",
    description: "Structured data, documents and presentation support.",
    icon: "table",
    services: [
      "Data Entry",
      "Excel Formatting",
      "PDF to Word",
      "PDF Formatting",
      "PowerPoint Presentation",
      "Copy-Paste Work",
      "Document Formatting",
      "Resume Formatting",
    ],
  },
  {
    name: "Content",
    slug: "content",
    description: "Writing, transcription and language support.",
    icon: "text",
    services: [
      "Content Writing",
      "Blog Writing",
      "Copywriting",
      "Caption Writing",
      "Transcription",
      "Translation",
    ],
  },
  {
    name: "Digital Support",
    slug: "digital-support",
    description: "Research, publishing and day-to-day digital assistance.",
    icon: "life-buoy",
    services: [
      "Web Research",
      "Product Listing",
      "Email Management",
      "Website Content Update",
      "Social Media Scheduling",
      "Audio Cleanup",
      "Subtitle/Captions",
      "Image Resize/Compress",
    ],
  },
];

function toSlug(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-");
}

async function main() {
  await withSeedOperation("Initialize the default CMS content", () =>
    prisma.$transaction(
      async (tx) => {
        // The settings record marks completed initial setup. Never resurrect
        // content that an administrator deliberately renamed or deleted.
        const existingSettings = await withSeedOperation(
          "Check whether initial CMS setup is complete",
          () => tx.siteSettings.findUnique({ where: { id: "singleton" } }),
        );
        if (existingSettings) return;

        await withSeedOperation("Create the initial profile", () =>
          tx.profile.upsert({
            where: { id: "singleton" },
            create: {
              id: "singleton",
              name: "Krushna Kalamkar",
              professionalTitle: "Founder of KAVERI DIGITAL SOLUTIONS",
              biography:
                "I'm Krushna Kalamkar, Founder of KAVERI DIGITAL SOLUTIONS. I am a Developer & AI Engineer with 3+ years of experience working with digital technologies and creative solutions. I help individuals, startups and businesses turn ideas into functional, modern and professional digital experiences.",
              experience: "3+ years",
              location: "Maharashtra, India",
              email: "kalamkarkrushna007@gmail.com",
              businessEmail: "icondigital.pvt.ltd@gmail.com",
              phone: "+91 7620702591",
              photoUrl: "/images/krushna-kalamkar.png",
            },
            update: {},
          }),
        );

        const socialLinks = [
          {
            platform: "instagram",
            label: "Instagram",
            url: "https://www.instagram.com/krushna_kalamkar_007/",
            order: 0,
          },
          {
            platform: "linkedin",
            label: "LinkedIn",
            url: "https://www.linkedin.com/in/krushna-kalamkar-416895328/",
            order: 1,
          },
        ];

        for (const link of socialLinks) {
          await withSeedOperation(`Ensure the ${link.platform} social link`, () =>
            tx.socialLink.upsert({
              where: { platform: link.platform },
              create: link,
              update: {},
            }),
          );
        }

        for (const [categoryIndex, definition] of categories.entries()) {
          const category = await withSeedOperation(
            `Ensure the "${definition.name}" service category`,
            () =>
              tx.serviceCategory.upsert({
                where: { slug: definition.slug },
                create: {
                  name: definition.name,
                  slug: definition.slug,
                  description: definition.description,
                  icon: definition.icon,
                  order: categoryIndex,
                },
                update: {},
              }),
          );

          for (const [serviceIndex, name] of definition.services.entries()) {
            const slug = toSlug(name);
            await withSeedOperation(`Ensure the "${name}" service`, () =>
              tx.service.upsert({
                where: { slug },
                create: {
                  categoryId: category.id,
                  name,
                  slug,
                  description: `${name} for individuals, startups and businesses.`,
                  order: serviceIndex,
                },
                update: {},
              }),
            );

            if (
              process.env.NODE_ENV === "test" &&
              process.env.PORTFOLIO_SEED_TEST_FAIL_AFTER === "first-service" &&
              categoryIndex === 0 &&
              serviceIndex === 0
            ) {
              throw new Error("Injected seed setup failure after the first service.");
            }
          }
        }

        await withSeedOperation("Create the initial site settings", () =>
          tx.siteSettings.create({
            data: {
              id: "singleton",
              siteTitle: "KAVERI DIGITAL SOLUTIONS",
              description:
                "KAVERI DIGITAL SOLUTIONS, founded by Krushna Kalamkar, offers web development, AI solutions, creative services and digital support.",
            },
          }),
        );
      },
      { maxWait: 10_000, timeout: 60_000 },
    ),
  );
}

async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const adminCount = await withSeedOperation(
    "Check whether an administrator account already exists",
    () => prisma.adminUser.count(),
  );
  if (email && password && adminCount === 0) {
    const hashedPassword = await withSeedOperation(
      "Hash the configured administrator password",
      () => bcrypt.hash(password, 12),
    );
    await withSeedOperation("Create the initial administrator account", () =>
      prisma.adminUser.create({ data: { email, hashedPassword } }),
    );
  }
}

main()
  .then(bootstrapAdmin)
  .catch((error) => {
    console.error(formatSeedFailure(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });