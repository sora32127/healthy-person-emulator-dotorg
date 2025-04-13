import { NavLink } from "@remix-run/react";
import { BsTwitterX } from "react-icons/bs";
import { SiMisskey } from "react-icons/si";
import { SiDiscord } from "react-icons/si";
import { SiBluesky } from "react-icons/si";
import { SiGithub } from "react-icons/si";

const footerItems = [
    {
        title: "管理人に連絡",
        url: "https://www.twitter.com/messages/compose?recipient_id=1249916069344473088"
    },
    {
        title: "サイト説明",
        url: "/readme"
    },
    {
        title: "プライバシー・ポリシー/免責事項",
        url: "/privacyPolicy"
    },
    {
        title: "寄付する",
        url: "/support"
    }
]

const socialLinks = [
    {
        title: "X",
        url: "https://x.com/helthypersonemu",
        icon: <BsTwitterX />
    },
    {
        title: "GitHub",
        url: "https://github.com/sora32127/healthy-person-emulator-dotorg",
        icon: <SiGithub />
    },
    {
        title: "Discord",
        url: "https://discord.com/invite/sQehNGTnSg",
        icon: <SiDiscord />
    },
    {
        title: "BlueSky",
        url: "https://bsky.app/profile/helthypersonemu.bsky.social",
        icon: <SiBluesky />
    },
    {
        title: "Mieeky.io",
        url: "https://misskey.io/@helthypersonemu",
        icon: <SiMisskey />
    }
]

const currentYear = "2025"

export const Footer = () => {
  return (
    <footer className="bg-base-200 py-8 md:py-8 md:mt-8 footer">
      <div className="container mx-auto px-4 flex flex-col items-center">
        <div className="flex flex-row justify-center gap-x-24 footer-content">
          <div className="footer-menus">
            <p className="footer-title">Menu</p>
            <div className="footer-links flex flex-col space-y-2">
              {footerItems.map((item) => (
                  <NavLink 
                    to={item.url} 
                    key={item.title} 
                    className="text-base-content hover:text-primary transition-colors duration-200"
                  >
                    {item.title}
                  </NavLink>
              ))}
            </div>
          </div>
          <div className="footer-socials">
            <p className="footer-title">Social</p>
            <div className="footer-links flex flex-col space-y-2">
              {socialLinks.map((item) => (
                  <NavLink 
                    to={item.url} 
                    key={item.title} 
                    className="text-base-content flex items-center gap-x-2 hover:text-primary transition-colors duration-200"
                  >
                    <p>{item.icon}</p>
                    <p>{item.title}</p>
                  </NavLink>
              ))}
            </div>
          </div>
        </div>
        <p className="text-base-content text-center mt-8">&copy; {currentYear} All rights reserved.</p>
      </div>
    </footer>
  )
}
